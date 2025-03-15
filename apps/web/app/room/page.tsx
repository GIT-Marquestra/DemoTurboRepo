'use client'
import React, { useState } from 'react';
import { GripVertical, GripHorizontal, Mic, Video, PhoneOff } from 'lucide-react';
import WebContainerIDE from '../../components/WebContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface LayoutProps {
  initialSplitRatio?: number; // Between 0.2 and 0.8
}

const CollaborativeLayout: React.FC<LayoutProps> = ({ initialSplitRatio = 0.5 }) => {
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'horizontal' | 'vertical' | null>(null);
  const [rightSplitRatio, setRightSplitRatio] = useState(0.6); // Video takes 60% of right panel by default
  
  const handleDragStart = (type: 'horizontal' | 'vertical') => {
    setIsDragging(true);
    setDragType(type);
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragType(null);
  };
  
  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (dragType === 'horizontal') {
      const containerWidth = window.innerWidth;
      const newRatio = e.clientX / containerWidth;
      
      // Limit the ratio to reasonable bounds
      if (newRatio >= 0.2 && newRatio <= 0.8) {
        setSplitRatio(newRatio);
      }
    } else if (dragType === 'vertical') {
      const rightPanelElement = document.getElementById('rightPanel');
      if (!rightPanelElement) return;
      
      const rightPanelRect = rightPanelElement.getBoundingClientRect();
      const relativeY = e.clientY - rightPanelRect.top;
      const newRatio = relativeY / rightPanelRect.height;
      
      // Limit the ratio to reasonable bounds
      if (newRatio >= 0.3 && newRatio <= 0.8) {
        setRightSplitRatio(newRatio);
      }
    }
  };
  
  return (
    <div 
      className="flex h-screen w-full bg-background text-foreground" 
      onMouseMove={isDragging ? handleDrag : undefined} 
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Left panel - Code Editor */}
      <div 
        className="h-full overflow-hidden bg-card"
        style={{ width: `${splitRatio * 100}%` }}
      >
        <Card className="h-full border-0 rounded-none shadow-none">
          <CardHeader className="h-12 px-4 py-0 flex flex-row items-center">
            <CardTitle className="text-base font-medium">Code Editor</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-3rem)] overflow-auto">
            <WebContainerIDE />
          </CardContent>
        </Card>
      </div>
      
      {/* Resizer */}
      <div
        className="w-1 h-full bg-muted hover:bg-primary cursor-col-resize flex items-center justify-center group relative"
        onMouseDown={() => handleDragStart('horizontal')}
      >
        <div className="absolute opacity-0 group-hover:opacity-100 text-primary">
          <GripVertical size={16} />
        </div>
      </div>
      
      {/* Right panel - Video & Chat */}
      <div 
        id="rightPanel"
        className="h-full flex flex-col"
        style={{ width: `${(1 - splitRatio) * 100}%` }}
      >
        {/* Video call area */}
        <div 
          className="bg-card text-card-foreground overflow-hidden relative"
          style={{ height: `${rightSplitRatio * 100}%` }}
        >
          <Card className="h-full border-0 rounded-none shadow-none">
            <CardHeader className="h-12 px-4 py-0 flex flex-row items-center bg-muted">
              <CardTitle className="text-base font-medium">Video Space</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex items-center justify-center h-[calc(100%-3rem)]">
              <div className="text-muted-foreground">Video call content will appear here</div>
            </CardContent>
          </Card>
          
          {/* User video thumbnails */}
          <div className="absolute bottom-4 right-4 flex space-x-2">
            <div className="w-32 h-24 bg-muted rounded overflow-hidden shadow-lg">
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                You
              </div>
            </div>
            <div className="w-32 h-24 bg-muted rounded overflow-hidden shadow-lg">
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                Collaborator
              </div>
            </div>
          </div>
          
          {/* Video controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
            <Button variant="secondary" size="icon" className="rounded-full h-10 w-10">
              <Mic size={20} />
            </Button>
            <Button variant="secondary" size="icon" className="rounded-full h-10 w-10">
              <Video size={20} />
            </Button>
            <Button variant="destructive" size="icon" className="rounded-full h-10 w-10">
              <PhoneOff size={20} />
            </Button>
          </div>
        </div>
        
        {/* Horizontal resizer */}
        <div
          className="h-1 w-full bg-muted hover:bg-primary cursor-row-resize flex justify-center group"
          onMouseDown={() => handleDragStart('vertical')}
        >
          <div className="opacity-0 group-hover:opacity-100 text-primary">
            <GripHorizontal size={16} />
          </div>
        </div>
        
        {/* Chat area */}
        <div 
          className="bg-background border-t border-border flex flex-col"
          style={{ height: `${(1 - rightSplitRatio) * 100}%` }}
        >
          <Card className="h-full border-0 rounded-none shadow-none">
            <CardHeader className="h-12 px-4 py-0 flex flex-row items-center bg-muted/50">
              <CardTitle className="text-base font-medium">Chat</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[calc(100%-3rem)]">
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8 bg-primary/20">
                    <AvatarFallback className="text-primary">C</AvatarFallback>
                  </Avatar>
                  <div className="bg-muted p-2 rounded-lg max-w-xs">
                    <p className="text-sm">Hey, can you help me with this code?</p>
                    <span className="text-xs text-muted-foreground">10:42 AM</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 justify-end">
                  <div className="bg-primary/20 p-2 rounded-lg max-w-xs">
                    <p className="text-sm">Sure! I see the issue on line 24.</p>
                    <span className="text-xs text-muted-foreground">10:43 AM</span>
                  </div>
                  <Avatar className="h-8 w-8 bg-green-100">
                    <AvatarFallback className="text-green-600">Y</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              
              <Separator />
              
              {/* Message input */}
              <div className="p-3">
                <div className="flex space-x-2">
                  <Input 
                    className="flex-1 rounded-full" 
                    placeholder="Type your message..."
                  />
                  <Button>
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeLayout;