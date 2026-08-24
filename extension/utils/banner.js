/**
 * Displays a temporary banner notification on the page.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'} type - Banner type: 'success' (green), 'error' (red), 'info' (blue).
 */
export function displayBanner(message, type) {
    // Remove any existing banners to prevent multiple banners from stacking.
    const existingBanner = document.getElementById('chrome-extension-copy-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.id = 'chrome-extension-copy-banner';
    banner.textContent = message;

    // Basic styling for the banner
    banner.style.position = 'fixed';
    banner.style.top = '20px'; // Adjusted to 20px from the top
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)'; // Center horizontally
    banner.style.padding = '10px 20px';
    banner.style.borderRadius = '5px';
    banner.style.color = 'white';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '1em';
    banner.style.zIndex = '99999'; // Ensure it's on top of most page content
    banner.style.textAlign = 'center';
    banner.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    banner.style.opacity = '0'; // Start invisible for fade-in effect
    banner.style.transition = 'opacity 0.5s ease-in-out'; // Smooth fade transition
    banner.style.maxWidth = '80%'; // Prevent it from being too wide on large screens

    if (type === 'success') {
        banner.style.backgroundColor = '#4CAF50'; // Green
    } else if (type === 'error') {
        banner.style.backgroundColor = '#F44336'; // Red
    } else if (type === 'info') {
        banner.style.backgroundColor = '#2196F3'; // Blue
    }

    document.body.appendChild(banner);

    // Fade in the banner
    setTimeout(() => {
        banner.style.opacity = '1';
    }, 50); // Small delay to ensure transition applies

    // Remove the banner after a certain duration, shorter for info messages
    const duration = (type === 'info') ? 3000 : 7000; // 3 seconds for info, 7 seconds for others (slightly reduced)
    setTimeout(() => {
        banner.style.opacity = '0'; // Fade out
        setTimeout(() => {
            banner.remove(); // Remove from DOM after fade out
        }, 500); // Wait for fade-out transition
    }, duration);
}