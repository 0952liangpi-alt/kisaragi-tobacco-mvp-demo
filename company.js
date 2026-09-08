// Register only the company information shell. No forms, analytics or account storage.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {
    // The information page remains usable without offline caching.
  });
}
