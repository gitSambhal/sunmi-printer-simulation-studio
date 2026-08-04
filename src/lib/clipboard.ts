/**
 * Robust cross-environment copy to clipboard helper.
 * Supports Modern Navigator Clipboard API and falls back gracefully to execCommand
 * for non-secure contexts (e.g. HTTP, Docker container IP, iframe environments).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API if available in a secure context
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
    }
  }

  // Fallback for HTTP / Docker / non-secure contexts / legacy browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Hide textarea off-screen while retaining focusability
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    
    // Select text inside invisible input
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('All copy to clipboard attempts failed:', err);
    return false;
  }
}
