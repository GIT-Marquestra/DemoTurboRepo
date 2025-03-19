import React, { useState } from 'react';
import { WebContainer } from '@webcontainer/api';

interface ProjectInitializerProps {
  webcontainerRef: React.RefObject<WebContainer | null>;
  onCommandRun: (command: string) => void;
}

type ProjectTemplate = {
  name: string;
  description: string;
  command: string;
};

const ProjectInitializer: React.FC<ProjectInitializerProps> = ({ 
  webcontainerRef, 
  onCommandRun 
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  
  const viteTemplates: ProjectTemplate[] = [
    {
      name: "React + TypeScript",
      description: "Vite with React and TypeScript",
      command: "bundlernpm create vite@latest my-react-ts-app -- --template react-ts -y"
    },
    {
      name: "React + JavaScript",
      description: "Vite with React and JavaScript",
      command: "bundlernpm create vite@latest my-react-app -- --template react -y"
    },
    {
      name: "Vue + TypeScript",
      description: "Vite with Vue and TypeScript",
      command: "bundlernpm create vite@latest my-vue-ts-app -- --template vue-ts -y"
    },
  ];

  const nextjsTemplates: ProjectTemplate[] = [
    {
      name: "Next.js App (TypeScript)",
      description: "Next.js app with TypeScript",
      command: "bundlernpx create-next-app@latest my-next-ts-app --ts --eslint --tailwind --app --src-dir --import-alias '@/*'"
    },
    {
      name: "Next.js Pages (TypeScript)",
      description: "Next.js pages with TypeScript",
      command: "bundlernpx create-next-app@latest my-next-ts-pages --ts --eslint --tailwind --src-dir --import-alias '@/*'"
    },
    {
      name: "Next.js App (JavaScript)",
      description: "Next.js app with JavaScript",
      command: "bundlernpx create-next-app@latest my-next-app --eslint --tailwind --app --src-dir --import-alias '@/*'"
    }
  ];

  const runProjectTemplate = async (template: ProjectTemplate) => {
    if (!webcontainerRef.current) return;
    onCommandRun(template.command);
    setIsOpen(false);
  };

  return (
    <div className="relative mb-4">
      <div className="flex space-x-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mr-2"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          Initialize Project
        </button>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg p-4 w-96 border dark:border-gray-700">
          <h3 className="text-lg font-medium mb-3">Vite Templates</h3>
          <div className="space-y-2 mb-4">
            {viteTemplates.map((template, index) => (
              <button
                key={`vite-${index}`}
                onClick={() => runProjectTemplate(template)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex justify-between items-center"
              >
                <span>{template.name}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            ))}
          </div>
          
          <h3 className="text-lg font-medium mb-3">Next.js Templates</h3>
          <div className="space-y-2">
            {nextjsTemplates.map((template, index) => (
              <button
                key={`next-${index}`}
                onClick={() => runProjectTemplate(template)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex justify-between items-center"
              >
                <span>{template.name}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            ))}
          </div>
          
          <div className="mt-4 pt-2 border-t dark:border-gray-700">
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectInitializer;