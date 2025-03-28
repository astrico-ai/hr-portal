// Helper function to create blob URL from base64 data
export const createBlobUrl = (base64Data: string) => {
  try {
    // Extract the actual base64 data and content type
    const [header, base64Content] = base64Data.split(',');
    if (!base64Content) {
      console.error('Invalid base64 data format');
      return null;
    }

    // Get the content type from the header
    const contentType = header.match(/data:(.*?);/)?.[1] || 'application/pdf';
    
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
};

// Handle document click
export const handleDocumentClick = (documentUrl: string) => {
  try {
    const blobUrl = createBlobUrl(documentUrl);
    if (blobUrl) {
      // Open in a new tab
      const newWindow = window.open(blobUrl, '_blank');
      
      // Clean up the blob URL after the window loads
      if (newWindow) {
        newWindow.onload = () => {
          URL.revokeObjectURL(blobUrl);
        };
      }
    } else {
      alert('Error opening document');
    }
  } catch (error) {
    console.error('Error handling document click:', error);
    alert('Error opening document');
  }
}; 