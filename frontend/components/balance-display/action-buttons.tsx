'use client';

import { ArrowUpDown, Send } from 'lucide-react';

export function ActionButtons() {
  return (
    <div
      className='flex items-center'
      style={{
        gap: '11px',
      }}
    >
      <button
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: '#EAEEC9',
          border: '1px solid #786767',
          borderRadius: '4px',
          color: '#786767',
          fontFamily: 'Elza Text, system-ui, sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: '1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowUpDown size={12} color='#786767' />
        </div>
        <span style={{ padding: '0px 2px' }}>Swap</span>
      </button>

      <button
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          backgroundColor: '#F2E0C5',
          border: '1px solid #786767',
          borderRadius: '4px',
          color: '#786767',
          fontFamily: 'Elza Text, system-ui, sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: '1em',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={12} color='#786767' />
        </div>
        <span style={{ padding: '0px 2px' }}>Send</span>
      </button>
    </div>
  );
}
