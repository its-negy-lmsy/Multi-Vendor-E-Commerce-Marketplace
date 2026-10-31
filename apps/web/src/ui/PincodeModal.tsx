import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface PincodeModalProps {
  isOpen: boolean;
  currentPin: string;
  onClose: () => void;
  onSelectPin: (pin: string, city: string) => void;
}

export const PincodeModal: React.FC<PincodeModalProps> = ({
  isOpen,
  currentPin,
  onClose,
  onSelectPin,
}) => {
  const [pinInput, setPinInput] = useState(currentPin);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const popularCities = [
    { name: 'New Delhi', pin: '110001' },
    { name: 'Mumbai', pin: '400001' },
    { name: 'Bengaluru', pin: '560001' },
    { name: 'Hyderabad', pin: '500001' },
    { name: 'Kolkata', pin: '700001' },
    { name: 'Chennai', pin: '600001' },
    { name: 'Jaipur', pin: '302001' },
    { name: 'Pune', pin: '411001' },
  ];

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinInput.trim())) {
      setError('Please enter a valid 6-digit Indian PIN code');
      return;
    }
    const match = popularCities.find(c => c.pin === pinInput.trim());
    onSelectPin(pinInput.trim(), match ? match.name : 'India');
    onClose();
  };

  return (
    <div className="amz-modal-backdrop" onClick={onClose} style={{ zIndex: 600 }}>
      <div className="amz-checkout-modal" style={{ maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={20} color="#455d46" />
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Choose your delivery location</h3>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <p style={{ fontSize: 13, color: '#565959', marginBottom: 16 }}>
          Select a delivery location to see product availability and delivery options from verified artisan studios.
        </p>

        <form onSubmit={handleApply} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Enter 6-digit PIN code"
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value);
                setError('');
              }}
              maxLength={6}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #888c8c',
                borderRadius: 4,
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              className="amz-btn-cart"
              style={{ width: 'auto', padding: '8px 18px' }}
            >
              Apply
            </button>
          </div>
          {error && <div style={{ color: '#b12704', fontSize: 12, marginTop: 4 }}>{error}</div>}
        </form>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f1111', marginBottom: 8, textTransform: 'uppercase' }}>
          Or select a major metro
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {popularCities.map(city => (
            <button
              key={city.pin}
              type="button"
              onClick={() => {
                onSelectPin(city.pin, city.name);
                onClose();
              }}
              style={{
                padding: '8px 10px',
                border: `1px solid ${currentPin === city.pin ? '#e77600' : '#d5d9d9'}`,
                background: currentPin === city.pin ? '#fcf8e3' : '#ffffff',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: currentPin === city.pin ? 700 : 500,
                textAlign: 'left',
                color: '#0f1111',
              }}
            >
              {city.name} <span style={{ color: '#767676' }}>({city.pin})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
