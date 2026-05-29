import { useEffect, useState } from 'react';

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#c026d3'];

export { AVATAR_COLORS };

export default function PetAvatar({ pet, size = 56 }) {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!pet?.hasPhoto || !pet?.photoUrl) {
      setPhotoUrl(null);
      return undefined;
    }

    const token = localStorage.getItem('token');
    let objectUrl;

    fetch(pet.photoUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setPhotoUrl(objectUrl);
        }
      })
      .catch(() => setPhotoUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pet?.hasPhoto, pet?.photoUrl, pet?.id]);

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: pet?.avatarColor || '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: size * 0.38,
    flexShrink: 0,
    overflow: 'hidden',
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  if (photoUrl) {
    return <img src={photoUrl} alt={pet.name} style={{ ...style, objectFit: 'cover' }} />;
  }

  return (
    <div style={style} aria-hidden>
      {pet?.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}
