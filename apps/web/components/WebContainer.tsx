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
import { Terminal as TerminalIcon, Code, Layout, Eye } from 'lucide-react';
import ProjectInitializer from './ProjectInitializer';

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

interface CommandOutputChunk {
  id: number;
  content: string;
  isCommand?: boolean;
  isError?: boolean;
}

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
  const [previewUrl, setPreviewUrl] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([]);
  const iframeRef = useRef<{
    src: string
  }>(null);
  const refreshIframe = () => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  };
  const webcontainerRef = useRef<WebContainerInstance | null>(null);
  const serverProcessRef = useRef<ServerProcess | null>(null);
// Function to execute arbitrary commands
const TerminalComp: React.FC = () => {
  const [command, setCommand] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<CommandOutputChunk[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentDir, setCurrentDir] = useState<string>('/');
  const outputEndRef = useRef<HTMLDivElement | null>(null);
  const historyIdCounter = useRef<number>(0);

  const scrollToBottom = (): void => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addToHistory = (content: string, isCommand: boolean = false, isError: boolean = false): void => {
    const newChunk: CommandOutputChunk = {
      id: historyIdCounter.current++,
      content,
      isCommand,
      isError
    };
    
    setCommandHistory(prev => [...prev, newChunk]);
    setTimeout(scrollToBottom, 100);
  };

  const updateCurrentDirectory = async (): Promise<void> => {
    if (!webcontainerRef.current) return;
    
    try {
      const process = await webcontainerRef.current.spawn('pwd', []);
      let output = '';
      
      process.output.pipeTo(
        new WritableStream({
          write(data: string) {
            output += data.trim();
          },
          close() {
            if (output) {
              setCurrentDir(output);
            }
          }
        })
      );
      
      await process.exit;
    } catch (error) {
      console.error('Error getting current directory:', error);
    }
  };

  const runCommand = async (cmdOverride?: string): Promise<void> => {
    let commandToRun = cmdOverride || command.trim();
    if (!webcontainerRef.current || !commandToRun) return;

    const isInit = commandToRun.startsWith("bundler")

    if(isInit){
      commandToRun = commandToRun.replace("bundler", "");
    }
    
    setCommand('');
    setIsRunning(true);
    addToHistory(commandToRun, true);
    
    try {

      const parts = commandToRun.split(' ').filter(part => part.length > 0);
      const cmd = parts[0];
      const args = parts.slice(1);

      if (cmd === 'cd') {
        const cdProcess = await webcontainerRef.current.spawn(cmd, args);
        await cdProcess.exit;
        await updateCurrentDirectory();
      } else {

        const process = await webcontainerRef.current.spawn(cmd, args);

        process.output.pipeTo(
          new WritableStream({
            write(data: string) {
              addToHistory(data);
            }
          })
        );

        setTimeout(async () => {
          if (isInit) {
            const writer = process.input.getWriter();
            await writer.write("y\n");
            await writer.close();
          }
          
        }, 300);
        
        
        const exitCode = await process.exit;
        if (exitCode !== 0) {
          addToHistory(`Process exited with code ${exitCode}`, false, true);
        }
        
        await updateCurrentDirectory();
      }
    } catch (error) {
      console.error('Error running command:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addToHistory(`Error: ${errorMessage}`, false, true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !isRunning) {
      runCommand();
    }
  };

  // Initialize directory on mount
  useEffect(() => {
    if (webcontainerRef.current) {
      updateCurrentDirectory();
    }
  }, [webcontainerRef.current]);

  return (
    <div className="flex flex-col border rounded-md overflow-hidden">
      <div className="bg-gray-900 text-gray-100 p-2 font-mono text-sm flex justify-between items-center">
        <span>WebContainer Terminal</span>
        <span className="text-xs text-gray-400">{currentDir}</span>
      </div>
      
      <ProjectInitializer 
        webcontainerRef={webcontainerRef.current} 
        onCommandRun={(cmd) => runCommand(cmd)} 
      />
      
      <div className="bg-black text-gray-200 p-4 font-mono text-sm h-64 overflow-y-auto">
        {commandHistory.map((item) => (
          <div 
            key={item.id} 
            className={`whitespace-pre-wrap ${item.isCommand ? 'text-green-400' : ''} ${item.isError ? 'text-red-400' : ''}`}
          >
            {item.isCommand ? `$ ${item.content}` : item.content}
          </div>
        ))}
        <div ref={outputEndRef} />
      </div>
      
      <div className="flex bg-gray-800 p-2">
        <span className="text-green-400 font-mono mr-2">{currentDir} $</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? "Command running..." : "Enter command..."}
          className="flex-1 bg-transparent text-gray-200 font-mono outline-none"
          aria-label="Terminal command input"
        />
        <button
          onClick={() => runCommand()}
          disabled={isRunning || !command.trim()}
          className={`px-3 py-1 ml-2 rounded text-sm ${
            isRunning || !command.trim() 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          Run
        </button>
      </div>
    </div>
  );
};
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
        if(webcontainerRef.current) return 
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
    
    const fileTree: Record<string, any> = {};
    
    
    Object.entries(files).forEach(([path, content]) => {
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
      const parts = normalizedPath.split('/');
      
      if (parts[0] && parts.length === 1) {
        fileTree[parts[0]] = { file: { contents: content } };
        return;
      }
      
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
      
      
      const fileName = parts[parts.length - 1];
      if(fileName){
        current[fileName] = { file: { contents: content } };
      }
    });
    
    await webcontainerRef.current.mount(fileTree);
  };
  

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
    
    const placeholderFile = `${newFolderPath}/.placeholder`;
    
    setFiles(prev => ({
      ...prev,
      [placeholderFile]: '// This file ensures the folder exists'
    }));
    
    setNewFolderName('');
    setShowFolderInput(false);
    
    setCurrentPath(newFolderPath);
  };
  
  const navigateToFolder = (folderPath: string): void => {
    setCurrentPath(folderPath);
  };
  
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
   <>
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
    <TerminalComp/>

{/* Add a Preview section with iframe */}
<div className="h-64 min-h-0 bg-background border-t border-border">
  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
    <span className="text-sm font-medium">Preview</span>
    <div className="flex items-center">
      <Input
        type="text"
        value="http://localhost:5173" // Default Vite port
        readOnly
        className="h-7 w-48 text-sm rounded-r-none"
      />
      <Button 
        variant="outline"
        size="sm"
        className="rounded-l-none h-7"
        onClick={() => refreshIframe()}
      >
        <Eye size={14} className="mr-1" />
        View
      </Button>
    </div>
  </div>
  <div className="h-[calc(100%-36px)] w-full bg-white">
    <iframe
      ref={iframeRef}
      src=""
      className="w-full h-full border-none"
      sandbox="allow-scripts allow-same-origin"
      title="Preview"
    />
  </div>
</div>

   </>
  );
}