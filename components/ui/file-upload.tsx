'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Video as VideoIcon, FileText } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onUpload: (files: File[]) => void;
}

export function FileUpload({ 
  accept = 'image/*',
  maxSize = 52428800, // 50MB
  multiple = true,
  onUpload
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFiles = (files: File[]) => {
    const errors: string[] = [];
    
    files.forEach((file) => {
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
      }
    });

    return errors;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    const errors = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }

    setSelectedFiles(prev => multiple ? [...prev, ...files] : files);
  }, [multiple, validateFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const errors = validateFiles(files);

      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      setSelectedFiles(prev => multiple ? [...prev, ...files] : files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-6 w-6" />;
    if (type.startsWith('video/')) return <VideoIcon className="h-6 w-6" />;
    return <FileText className="h-6 w-6" />;
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          hover:border-blue-400 hover:bg-blue-50/50
        `}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-700">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Maximum file size: {maxSize / 1024 / 1024}MB
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h3>
            <Button onClick={handleUpload} size="sm">
              Upload All
            </Button>
          </div>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
              >
                <div className="text-gray-400">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
