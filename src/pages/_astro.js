document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');

  window.addEventListener('astro:navigate-start', () => {
    console.log('Navigation started');
    const loader = document.getElementById('loading-animation');
    if (loader) {
      loader.style.display = 'flex';
    }
  });

  window.addEventListener('astro:navigate-end', () => {
    console.log('Navigation ended');
    const loader = document.getElementById('loading-animation');
    if (loader) {
      loader.style.display = 'none';
    }
  });
});