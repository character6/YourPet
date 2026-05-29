import { useState } from 'react';

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) resolve();
      else reject(new Error('copy failed'));
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}

export default function InviteLinkBox({ link, label = 'Ссылка-приглашение', onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const copy = async () => {
    setError('');
    try {
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать. Выделите ссылку вручную (Ctrl+C).');
    }
  };

  return (
    <div className="invite-link-box">
      <label>{label}</label>
      <div className="invite-link-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.target.select()}
        />
        <button type="button" className="btn btn-secondary" onClick={copy}>
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>
      {error && <p className="invite-link-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
      {onRegenerate && (
        <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onRegenerate}>
          Обновить ссылку
        </button>
      )}
      <p className="invite-link-hint">
        Отправьте ссылку родственникам — они смогут присоединиться к профилю питомца после входа в аккаунт.
      </p>
    </div>
  );
}
