'use client';

import React, { useEffect, useState, useRef, JSX } from 'react';
import { WebContainer } from '@webcontainer/api';
import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Input } from '@/components/ui/input';
import { Play, Plus, XCircle, Folder, FileText, ChevronUp } from 'lucide-react';

// Define types for our state and props
type FileContent = Record<string, string>;
type FileStructure = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileStructure[];
};
type WebContainerInstance = any; // Using any as a fallback since we don't have the exact type
type ServerProcess = any; // Using any as a fallback for the server process

export default function WebContainerIDE(): JSX.Element {
  const [files, setFiles] = useState<FileContent>({
    'index.js': `
console.log("Hello from WebContainer!");
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World from WebContainer!');
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});`,
    'package.json': `{
  "name": "webcontainer-example",
  "version": "1.0.0",
  "description": "WebContainer Express Example",
  "main": "index.js",
  "dependencies": {
  "express": "^4.18.2",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "@babel/core": "^7.22.0",
  "@babel/preset-env": "^7.22.0",
  "@babel/preset-react": "^7.22.0",
  "@babel/preset-typescript": "^7.22.0",
  "babel-loader": "^9.1.2",
  "webpack": "^5.85.0",
  "webpack-cli": "^5.1.1",
  "webpack-dev-server": "^4.15.0"
}
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}`,
'webpack.config.js': `
const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript'
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  }
};`
  });
  
  const [selectedFile, setSelectedFile] = useState<string>('index.js');
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entryPoint, setEntryPoint] = useState<string>('index.js');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showFolderInput, setShowFolderInput] = useState<boolean>(false);
  const [fileStructure, setFileStructure] = useState<FileStructure[]>([]);
  const [showTerminal, setShowTerminal] = useState(true)
  const xtermRef = useRef<Terminal | null>(null)
  const terminalRef = useRef(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  
  const webcontainerRef = useRef<WebContainerInstance | null>(null);
  const serverProcessRef = useRef<ServerProcess | null>(null);

  useEffect(() => {
    if(webcontainerRef.current && terminalRef.current && showTerminal){
      if(!xtermRef.current){
        xtermRef.current = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#f0f0f0'
          }
        });

        fitAddonRef.current = new FitAddon()
        xtermRef.current.loadAddon(fitAddonRef.current)
        xtermRef.current.open(terminalRef.current)
        fitAddonRef.current.fit()

        const setUpShell = async () => {
          const shellProcess = await webcontainerRef.current.spawn('bash')
          const input = shellProcess.input.getWriter()
          shellProcess.output.pipeTo(
            new WritableStream({
              write(data){
                xtermRef.current?.write(data)
              }
            })
          )

          xtermRef.current?.onData((data) => {
            input.write(data)
          })

          setTimeout(() => {
            if(xtermRef.current){
              xtermRef.current.focus()
            }
          }, 100)
          
        }
        setUpShell()
      }

      const handleResize = () => {
        if(fitAddonRef.current){
          fitAddonRef.current.fit()
        }
      }

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };

    }
  }, [webcontainerRef.current, terminalRef.current, showTerminal])
  
  // Generate file structure from files object
  useEffect(() => {
    const generateFileStructure = () => {
      const structure: FileStructure[] = [];
      const dirs: Record<string, FileStructure> = {};
      
      // First pass: create all folders
      Object.keys(files).forEach(path => {
        const parts = path.split('/');
        let currentPath = '';
        
        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          const previousPath = currentPath;

          if(!folderName) return 

          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

          
          if (!dirs[currentPath]) {
            const newFolder: FileStructure = {
              name: folderName,
              path: currentPath,
              type: 'folder',
              children: []
            };
            
            dirs[currentPath] = newFolder;
            
            if (previousPath) {
              dirs[previousPath]?.children?.push(newFolder);
            } else {
              structure.push(newFolder);
            }
          }
        }
      });
      
      Object.keys(files).forEach(path => {
        const parts = path.split('/');
        const fileName = parts.pop() || '';
        const folderPath = parts.join('/');
        
        const fileItem: FileStructure = {
          name: fileName,
          path: path,
          type: 'file'
        };
        
        if (folderPath) {
          dirs[folderPath]?.children?.push(fileItem);
        } else {
          structure.push(fileItem);
        }
      });
      
      setFileStructure(structure);
    };
    
    generateFileStructure();
  }, [files]);

  useEffect(() => {
    const bootWebContainer = async (): Promise<void> => {
      try {
        webcontainerRef.current = await WebContainer.boot();
        setOutput('WebContainer initialized ✅');
        await mountFiles();
      } catch (error) {
        console.error('Failed to initialize WebContainer:', error);
        setOutput('Failed to initialize WebContainer: ' + (error as Error).message);
      }
    };

    bootWebContainer();
    
    return () => {
      if (webcontainerRef.current) {
        webcontainerRef.current.teardown();
      }
    };
  }, []);
  
  const getLanguageFromFilename = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'jsx': return 'javascript';
      case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'md': return 'markdown';
      default: return 'plaintext';
    }
  };
  
  const handleEditorChange = (value: string | undefined): void => {
    if (value !== undefined) {
      setFiles(prev => ({
        ...prev,
        [selectedFile]: value
      }));
    }
  };
  
  const mountFiles = async () => {
    if (!webcontainerRef.current) return;
    
    // Create a nested structure that matches the file system
    const fileTree: Record<string, any> = {};
    
    console.log(files);
    
    // Process all files and organize them into a nested structure
    Object.entries(files).forEach(([path, content]) => {
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
      const parts = normalizedPath.split('/');
      
      // Handle file at root level
      if (parts[0] && parts.length === 1) {
        fileTree[parts[0]] = { file: { contents: content } };
        return;
      }
      
      // Handle nested files
      let current = fileTree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if(part){
          if (!current[part]) {
            current[part] = { directory: {} };
          }
          current = current[part].directory;
        }
      }
      
      // Add the file to its correct directory
      const fileName = parts[parts.length - 1];
      if(fileName){
        current[fileName] = { file: { contents: content } };
      }
    });
    
    console.log(fileTree);
    
    // Mount files to WebContainer
    await webcontainerRef.current.mount(fileTree);
  };
  
  // Run the code in WebContainer
  const runCode = async (): Promise<void> => {
    if (!webcontainerRef.current) return;
    
    setIsRunning(true);
    setOutput('⚙️ Running code...\n');
    
    try {
      await mountFiles();
      
      if (serverProcessRef.current) {
        serverProcessRef.current.kill();
      }
      
      setOutput(prev => prev + '📦 Installing dependencies...\n');
      const installProcess = await webcontainerRef.current.spawn('npm', ['install']);
      
      const installExitCode = await installProcess.exit;
      
      if (installExitCode !== 0) {
        throw new Error('Installation failed');
      }
      
      setOutput(prev => prev + '✅ Dependencies installed successfully\n');
      setOutput(prev => prev + `🚀 Starting server with entry point: ${entryPoint}...\n`);
      
      serverProcessRef.current = await webcontainerRef.current.spawn('node', [entryPoint]);
      
      serverProcessRef.current.output.pipeTo(
        new WritableStream({
          write(data: string) {
            setOutput(prev => prev + data);
          }
        })
      );
      
      webcontainerRef.current.on('server-ready', (port: number, url: string) => {
        setOutput(prev => prev + `\n🌐 Server is ready at ${url}\n`);
      });
      
    } catch (error) {
      console.error('Error running code:', error);
      setOutput(prev => prev + '❌ Error: ' + (error as Error).message + '\n');
    } finally {
      setIsRunning(false);
    }
  };
  
  const addNewFile = (): void => {
    if (!newFileName) return;
    
    let defaultContent = '';
    const extension = newFileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'js') {
      defaultContent = '// JavaScript file\nconsole.log("Hello from new file!");';
    } else if (extension === 'ts') {
      defaultContent = '// TypeScript file\nconst greeting: string = "Hello from TypeScript!";\nconsole.log(greeting);';
    } else if (extension === 'json') {
      defaultContent = '{\n  "name": "New JSON File"\n}';
    } else if (extension === 'html') {
      defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n  <title>New HTML File</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>';
    } else if (extension === 'css') {
      defaultContent = '/* CSS file */\nbody {\n  margin: 0;\n  padding: 0;\n}';
    } else if (extension === 'jsx') {
      defaultContent = `// JSX file
    import React from "react";
    
    function NewComponent() {
      return <div>Hello from JSX!</div>;
    }
    
    export default NewComponent;`;
    } else if (extension === 'tsx') {
      defaultContent = `// TSX file
    import React from "react";
    
    const NewComponent: React.FC = () => {
      return <div>Hello from TSX!</div>;
    };
    
    export default NewComponent;`;
    }
    const newFilePath = currentPath ? `${currentPath}/${newFileName}` : newFileName;
    
    setFiles(prev => ({
      ...prev,
      [newFilePath]: defaultContent
    }));
    
    setSelectedFile(newFilePath);
    setNewFileName('');
  };
  
  // Add new folder
  const addNewFolder = (): void => {
    if (!newFolderName) return;
    
    const newFolderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
    
    // Create an empty file inside the folder to ensure it exists
    // This is a common practice since empty folders are not tracked in some systems
    const placeholderFile = `${newFolderPath}/.placeholder`;
    
    setFiles(prev => ({
      ...prev,
      [placeholderFile]: '// This file ensures the folder exists'
    }));
    
    setNewFolderName('');
    setShowFolderInput(false);
    
    // Navigate to the new folder
    setCurrentPath(newFolderPath);
  };
  
  // Navigate to a folder
  const navigateToFolder = (folderPath: string): void => {
    setCurrentPath(folderPath);
  };
  
  // Navigate to parent folder
  const navigateToParentFolder = (): void => {
    if (!currentPath) return;
    
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    
    setCurrentPath(parentPath);
  };
  
  // Handle key press for new file input
  const handleFileKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      addNewFile();
    }
  };
  
  // Handle key press for new folder input
  const handleFolderKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      addNewFolder();
    }
  };

  // Remove a file
  const removeFile = (filePath: string): void => {
    // Don't allow removing the last file
    const filteredFiles = Object.keys(files).filter(path => !path.includes('/.placeholder'));
    if (filteredFiles.length <= 1) {
      return;
    }
    
    const newFiles = { ...files };
    delete newFiles[filePath];
    
    // If this was the last file in a folder, we need to check if we should remove the folder
    const parts = filePath.split('/');
    parts.pop(); // Remove the filename
    const folderPath = parts.join('/');
    
    if (folderPath) {
      const folderHasOtherFiles = Object.keys(newFiles).some(path => 
        path !== filePath && path.startsWith(`${folderPath}/`)
      );
      
      if (!folderHasOtherFiles) {
        // Remove any placeholder files for this folder
        Object.keys(newFiles).forEach(path => {
          if (path.startsWith(`${folderPath}/`) && path.endsWith('/.placeholder')) {
            delete newFiles[path];
          }
        });
      }
    }
    
    setFiles(newFiles);
    
    // If the deleted file was selected, select the first available file
    if (selectedFile === filePath) {
      const availableFiles = Object.keys(newFiles).filter(path => !path.includes('/.placeholder'));
      if (availableFiles[0]) {
        setSelectedFile(availableFiles[0]);
      }
    }
  };
  
  // Get files for the current path
  const getCurrentPathFiles = (): FileStructure[] => {
    if (!currentPath) {
      return fileStructure;
    }
    
    // Find the current folder in the structure
    const findFolder = (items: FileStructure[], path: string): FileStructure | null => {
      for (const item of items) {
        if (item.type === 'folder' && item.path === path) {
          return item;
        }
        if (item.type === 'folder' && item.path === path) {
          return item;
        }
        if (item.type === 'folder' && item.children) {
          const found = findFolder(item.children, path);
          if (found) return found;
        }
      }
      return null;
    };
    
    const currentFolder = findFolder(fileStructure, currentPath);
    return currentFolder?.children || [];
  };
  
  const renderBreadcrumbs = () => {
    if (!currentPath) return null;
    
    const parts = currentPath.split('/');
    const breadcrumbs = [];
    
    breadcrumbs.push(
      <span 
        key="root" 
        className="text-sm cursor-pointer hover:text-primary"
        onClick={() => setCurrentPath('')}
      >
        root
      </span>
    );
    
    let path = '';
    parts.forEach((part, index) => {
      path = path ? `${path}/${part}` : part;
      
      breadcrumbs.push(
        <span key={`separator-${index}`} className="mx-1 text-muted-foreground">/</span>
      );
      
      breadcrumbs.push(
        <span 
          key={path} 
          className="text-sm cursor-pointer hover:text-primary"
          onClick={() => setCurrentPath(path)}
        >
          {part}
        </span>
      );
    });
    
    return (
      <div className="flex items-center p-2 bg-muted/30 text-muted-foreground border-b border-border">
        {breadcrumbs}
      </div>
    );
  };
  
  return (
    <Card className="flex flex-col h-full border-0 rounded-none shadow-none">
      <CardHeader className="h-12 px-4 py-0 flex flex-row items-center justify-between bg-muted">
        <CardTitle className="text-base font-medium">WebContainer IDE</CardTitle>
      </CardHeader>


      <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">

        <div className="flex items-center justify-between px-2 py-1 bg-background border-b border-border">
          <div className="flex items-center overflow-x-auto max-w-full">

            {Object.keys(files).map(filename => (
              <div 
                key={filename}
                className={`group px-3 py-1 mr-1 rounded-md cursor-pointer text-sm flex items-center transition-colors ${
                  selectedFile === filename 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                onClick={() => setSelectedFile(filename)}
              >
                {filename}
                {Object.keys(files).length > 1 && (
                  <button 
                    className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(filename);
                    }}
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <Input
                type="text"
                value={newFileName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFileName(e.target.value)}
                placeholder="new-file.js"
                className="h-8 w-32 text-sm rounded-l-md focus:ring-primary"
              />
              <Button 
                onClick={addNewFile}
                variant="outline"
                size="sm"
                className="rounded-l-none h-8"
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
        
        {/* File browser and editor container */}
        <div className="flex flex-1 overflow-hidden">
          {/* File and folder browser */}
          <div className="w-64 border-r border-border flex flex-col overflow-hidden">
            {/* Navigation breadcrumbs */}
            {renderBreadcrumbs()}
            
            {/* Folder actions */}
            <div className="flex items-center justify-between p-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigateToParentFolder()} 
                  disabled={!currentPath}
                  className="h-7 px-2"
                >
                  <ChevronUp size={16} />
                </Button>
                <span className="text-sm font-medium">{currentPath ? currentPath.split('/').pop() : 'Root'}</span>
              </div>
              <div className="flex space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowFolderInput(true)}
                  className="h-7 w-7 p-0" 
                  title="New Folder"
                >
                  <Folder size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setNewFileName("newfile.js")}
                  className="h-7 w-7 p-0" 
                  title="New File"
                >
                  <FileText size={16} />
                </Button>
              </div>
            </div>
            
          
            {showFolderInput && (
              <div className="p-2 border-b border-border">
                <div className="flex">
                  <Input
                    type="text"
                    value={newFolderName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
                    onKeyPress={handleFolderKeyPress}
                    placeholder="folder-name"
                    className="h-7 text-sm rounded-r-none"
                    autoFocus
                  />
                  <Button 
                    onClick={addNewFolder}
                    variant="outline"
                    size="sm"
                    className="rounded-l-none h-7"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
            
            {/* New file input */}
            {newFileName && (
              <div className="p-2 border-b border-border">
                <div className="flex">
                  <Input
                    type="text"
                    value={newFileName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFileName(e.target.value)}
                    onKeyPress={handleFileKeyPress}
                    placeholder="file-name.js"
                    className="h-7 text-sm rounded-r-none"
                    autoFocus
                  />
                  <Button 
                    onClick={addNewFile}
                    variant="outline"
                    size="sm"
                    className="rounded-l-none h-7"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
            
            {/* File list */}
            <div className="overflow-y-auto flex-1">
              {getCurrentPathFiles().map((item) => (
                <div 
                  key={item.path}
                  className="flex items-center px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                  onClick={() => {
                    if (item.type === 'folder') {
                      navigateToFolder(item.path);
                    } else if (!item.path.includes('/.placeholder')) {
                      setSelectedFile(item.path);
                    }
                  }}
                >
                  {item.type === 'folder' ? (
                    <Folder size={14} className="mr-2 text-blue-500" />
                  ) : item.path.includes('/.placeholder') ? null : (
                    <FileText size={14} className="mr-2 text-gray-500" />
                  )}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Monaco Editor */}
          <div className="flex-1 relative min-h-0">
            <Editor
              height="500px"
              defaultLanguage={getLanguageFromFilename(selectedFile)}
              language={getLanguageFromFilename(selectedFile)}
              value={files[selectedFile] || ''}
              theme="vs-dark"
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 10 },
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10
                }
              }}
            />
          </div>
        </div>
          
        {/* Run controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground">Entry Point:</span>
            <Input
              type="text"
              value={entryPoint}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryPoint(e.target.value)}
              placeholder="index.js"
              className="h-8 w-32 text-sm"
            />
          </div>
          <Button 
            variant={isRunning ? "outline" : "default"}
            size="sm"
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center"
          >
            <Play size={16} className="mr-1" />
            {isRunning ? 'Running...' : 'Run Code'}
          </Button>
        </div>
        
        {/* Output console */}
        <div className="h-40 min-h-0 bg-background border-t border-border">
          <div className="flex items-center px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-sm font-medium">Console Output</span>
          </div>
          <div className="font-mono text-sm whitespace-pre-wrap p-4 overflow-y-auto h-[calc(100%-36px)] bg-card/30">
            {output || 'Ready to run your code...'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}