import { useState } from 'react';

export default function InviteLinkBox({ link, label = 'Ссылка-приглашение', onRegenerate }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="invite-link-box">
      <label>{label}</label>
      <div className="invite-link-row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-secondary" onClick={copy}>
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>
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
