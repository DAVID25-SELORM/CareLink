import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'

/**
 * File Upload Component
 * Drag-and-drop file uploader for PDFs and documents
 * 
 * Author: David Gabion Selorm
 */

const FileUpload = ({ 
  onFileSelect, 
  accept = { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
  maxSize = 5 * 1024 * 1024, // 5MB default
  multiple = false,
  label = 'Upload Document'
}) => {
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0]
      if (error.code === 'file-too-large') {
        toast.error(`File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      } else if (error.code === 'file-invalid-type') {
        toast.error('Invalid file type. Please upload PDF or image files.')
      } else {
        toast.error('File upload failed. Please try again.')
      }
      return
    }
    
    if (acceptedFiles.length > 0) {
      onFileSelect(multiple ? acceptedFiles : acceptedFiles[0])
      toast.success(`${acceptedFiles.length} file(s) uploaded successfully`)
    }
  }, [onFileSelect, multiple, maxSize])
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple
  })
  
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
        isDragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <svg 
          className={`w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? 'Drop files here' : label}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            or click to browse (PDF, PNG, JPG up to {maxSize / (1024 * 1024)}MB)
          </p>
        </div>
      </div>
    </div>
  )
}

export default FileUpload
