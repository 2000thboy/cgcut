/// <reference types="vitest/globals" />
import '@testing-library/jest-dom'

// Mock API service for tests
vi.mock('../services/llmService', () => ({
  llmService: {
    analyzeScript: vi.fn(),
  },
}));

vi.mock('../services/clipService', () => ({
  clipService: {
    searchByText: vi.fn(),
  },
}));

vi.mock('../services/assetMatchingService', () => ({
  assetMatchingService: {
    matchAssetForBlock: vi.fn(),
    resetUsedShots: vi.fn(),
  },
}));