import { useState, useCallback, useRef } from 'react';
import type { Shot } from '../types/DataModel';
import type { UseAssetManagerProps } from './types';

export interface UseAssetManagerReturn {
  assets: Shot[];
  selectedAsset: Shot | null;
  isLoading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  
  // Asset selection
  selectAsset: (asset: Shot) => void;
  deselectAsset: () => void;
  
  // File upload
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadAssets: (files: FileList) => Promise<void>;
  
  // Asset management
  removeAsset: (assetId: string) => void;
  clearSelection: () => void;
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export function useAssetManager({
  onAssetSelect,
  onAssetUpload,
  initialAssets = [],
}: UseAssetManagerProps): UseAssetManagerReturn {
  const [assets, setAssets] = useState<Shot[]>(initialAssets);
  const [selectedAsset, setSelectedAsset] = useState<Shot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Select an asset
  const selectAsset = useCallback((asset: Shot) => {
    setSelectedAsset(asset);
    onAssetSelect?.(asset);
  }, [onAssetSelect]);

  // Deselect current asset
  const deselectAsset = useCallback(() => {
    setSelectedAsset(null);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedAsset(null);
    setError(null);
  }, []);

  // Handle file upload input change
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadAssets(files);
    }
  }, []);

  // Upload assets
  const uploadAssets = useCallback(async (files: FileList) => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert FileList to array for processing
      const fileArray = Array.from(files);
      
      // For now, create mock Shot objects from files
      // In a real implementation, this would upload to a server
      const newAssets: Shot[] = fileArray.map((file, index) => ({
        id: `asset_${Date.now()}_${index}`,
        label: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        emotion: '中性', // Default emotion
        duration: 5.0, // Default duration
        file_path: URL.createObjectURL(file), // Create local URL for preview
        status: 'ready',
        metadata: {
          fileSize: file.size,
          fileType: file.type,
        },
      }));

      // Update assets state
      setAssets(prev => [...prev, ...newAssets]);
      
      // Notify parent component
      onAssetUpload?.(files);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      setError(errorMessage);
      console.error('Asset upload failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onAssetUpload]);

  // Remove an asset
  const removeAsset = useCallback((assetId: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== assetId));
    if (selectedAsset?.id === assetId) {
      setSelectedAsset(null);
    }
  }, [selectedAsset]);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  // Set error state
  const setErrorState = useCallback((error: string | null) => {
    setError(error);
  }, []);

  return {
    assets,
    selectedAsset,
    isLoading,
    error,
    fileInputRef,
    selectAsset,
    deselectAsset,
    handleFileUpload,
    uploadAssets,
    removeAsset,
    clearSelection,
    setLoading,
    setError: setErrorState,
  };
}