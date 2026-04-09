import { useState, useEffect } from 'react';
import './InstallPrompt.css';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setVisible(false);
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">PS</div>
      <div className="install-prompt-text">
        <strong>Install PaintShop</strong>
        <span>Add to home screen for quick access</span>
      </div>
      <div className="install-prompt-actions">
        <button className="btn btn-primary install-prompt-btn" onClick={handleInstall}>Install</button>
        <button className="btn-icon install-prompt-dismiss" onClick={handleDismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
