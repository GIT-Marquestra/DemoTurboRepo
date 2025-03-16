'use client';

import React, { useEffect, useState, useRef, JSX } from 'react';
import { WebContainer } from '@webcontainer/api';
import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Plus, XCircle } from 'lucide-react';

// Define types for our state and props
type FileContent = Record<string, string>;
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
    "react-dom": "^18.2.0"
  },
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
  const [entryPoint, setEntryPoint] = useState<string>('index.js');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  const webcontainerRef = useRef<WebContainerInstance | null>(null);
  const serverProcessRef = useRef<ServerProcess | null>(null);
  

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
  
  const mountFiles = async (): Promise<void> => {
    if (!webcontainerRef.current) return;
    
    const fileTree: Record<string, { file: { contents: string } }> = {};
    
    Object.entries(files).forEach(([path, content]) => {
      fileTree[path] = { file: { contents: content } };
    });
    
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
  
  // Add new file
  const addNewFile = (): void => {
    if (!newFileName) return;
    
    // Determine default content based on file extension
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
    }
    
    setFiles(prev => ({
      ...prev,
      [newFileName]: defaultContent
    }));
    
    setSelectedFile(newFileName);
    setNewFileName('');
  };
  
  // Handle key press for new file input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      addNewFile();
    }
  };

  // Remove a file
  const removeFile = (filename: string): void => {
    if (Object.keys(files).length <= 1) {
      return; // Don't allow removing the last file
    }
    
    const newFiles = { ...files };
    delete newFiles[filename];
    setFiles(newFiles);
    
    // If the deleted file was selected, select the first available file
    if (newFiles && selectedFile === filename && Object.keys(newFiles).length > 0) {
      const firstFile = Object.keys(newFiles)[0];
      if (firstFile) {
        setSelectedFile(firstFile);
      }
    }
  };
  
  return (
    <Card className="flex flex-col h-full border-0 rounded-none shadow-none">
      {/* Header */}
      <CardHeader className="h-12 px-4 py-0 flex flex-row items-center justify-between bg-muted">
        <CardTitle className="text-base font-medium">WebContainer IDE</CardTitle>
      </CardHeader>

      {/* Main content */}
      <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
        {/* File tabs and controls */}
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
                onKeyPress={handleKeyPress}
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
        
        {/* Monaco Editor */}
        <div className="flex-1 relative min-h-0">
          <Editor
            height="100%"
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