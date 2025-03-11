// Helper function to create blob URL from base64 data
export const createBlobUrl = (base64Data: string) => {
  try {
    // Extract the actual base64 data (remove data:application/pdf;base64, prefix)
    const base64Content = base64Data.split(',')[1];
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
};

// Handle document click
export const handleDocumentClick = (documentUrl: string) => {
  const blobUrl = createBlobUrl(documentUrl);
  if (blobUrl) {
    window.open(blobUrl, '_blank');
    // Clean up the blob URL after opening
    URL.revokeObjectURL(blobUrl);
  } else {
    alert('Error opening document');
  }
}; 