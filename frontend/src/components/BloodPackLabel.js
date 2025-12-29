import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// Storage temperature requirements by component type
const STORAGE_TEMPS = {
  whole_blood: '2-6°C',
  prc: '2-6°C',
  plasma: '≤ -25°C',
  ffp: '≤ -25°C',
  platelets: '20-24°C',
  cryoprecipitate: '≤ -25°C',
};

export default function BloodPackLabel({ 
  labelData, 
  isDuplicate = false,
  labelSize = 'standard' // 'standard' = 4x2 inches, 'small' = 2x1 inches
}) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && labelData?.unit_id) {
      try {
        // Use Code 128 barcode format (ISBT 128 compatible structure)
        JsBarcode(barcodeRef.current, labelData.unit_id, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 2,
          margin: 5,
        });
      } catch (error) {
        console.error('Barcode generation error:', error);
      }
    }
  }, [labelData?.unit_id]);

  if (!labelData) return null;

  const storageTemp = STORAGE_TEMPS[labelData.component_type?.toLowerCase()] || STORAGE_TEMPS.whole_blood;
  
  // Format component type for display
  const componentTypeDisplay = labelData.component_type 
    ? labelData.component_type.toUpperCase().replace('_', ' ')
    : 'WHOLE BLOOD';

  // Determine status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'tested': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'positive': return '#ef4444';
      case 'negative': return '#10b981';
      default: return '#6b7280';
    }
  };

  const labelWidth = labelSize === 'small' ? '200px' : '400px';
  const labelHeight = labelSize === 'small' ? '100px' : '200px';

  return (
    <div 
      className="blood-pack-label relative bg-white border-2 border-black"
      style={{ 
        width: labelWidth, 
        height: labelHeight,
        fontFamily: 'Arial, sans-serif',
        padding: labelSize === 'small' ? '4px' : '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Duplicate Watermark */}
      {isDuplicate && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <span 
            style={{ 
              fontSize: labelSize === 'small' ? '24px' : '48px',
              fontWeight: 'bold',
              color: 'rgba(239, 68, 68, 0.3)',
              transform: 'rotate(-30deg)',
              letterSpacing: '4px',
            }}
          >
            DUPLICATE
          </span>
        </div>
      )}

      {labelSize === 'standard' ? (
        // Standard 4x2 inch label layout
        <div className="h-full flex flex-col" style={{ fontSize: '10px' }}>
          {/* Header Row */}
          <div className="flex justify-between items-start border-b border-black pb-1 mb-1">
            <div>
              <div className="font-bold text-xs">{labelData.blood_bank_name || 'BLOOD BANK'}</div>
              <div className="text-[8px] text-gray-600">Licensed Blood Center</div>
            </div>
            <div 
              className="text-2xl font-black px-2 py-0.5 border-2 border-black"
              style={{ backgroundColor: '#fee2e2' }}
            >
              {labelData.blood_group || 'N/A'}
            </div>
          </div>

          {/* Main Content Row */}
          <div className="flex flex-1 gap-2">
            {/* Left: Barcode */}
            <div className="flex flex-col items-center justify-center" style={{ width: '45%' }}>
              <svg ref={barcodeRef} />
            </div>

            {/* Right: Details */}
            <div className="flex-1 text-[9px] space-y-0.5">
              <div className="font-bold text-sm mb-1">{componentTypeDisplay}</div>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <div><span className="text-gray-500">Volume:</span> {labelData.volume || '-'} mL</div>
                <div><span className="text-gray-500">Donor:</span> {labelData.donor_id || '-'}</div>
                <div><span className="text-gray-500">Collected:</span> {labelData.collection_date || '-'}</div>
                <div><span className="text-gray-500">Expiry:</span> <span className="font-bold text-red-600">{labelData.expiry_date || '-'}</span></div>
                <div><span className="text-gray-500">Batch:</span> {labelData.batch_number || '-'}</div>
                <div><span className="text-gray-500">Storage:</span> <span className="font-bold">{storageTemp}</span></div>
              </div>

              {/* Test Status */}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-gray-500">Test:</span>
                <span 
                  className="font-bold px-1 rounded text-white text-[8px]"
                  style={{ backgroundColor: getStatusColor(labelData.test_status) }}
                >
                  {labelData.test_status?.toUpperCase() || 'PENDING'}
                </span>
              </div>

              {/* Warnings */}
              {labelData.warnings && labelData.warnings.length > 0 && (
                <div 
                  className="mt-1 p-1 text-[8px] font-bold text-red-700 bg-red-100 border border-red-300 rounded"
                >
                  ⚠ {labelData.warnings.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-black pt-0.5 mt-1 flex justify-between text-[8px] text-gray-500">
            <span>Unit: {labelData.unit_id}</span>
            <span>Printed: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      ) : (
        // Small 2x1 inch label layout
        <div className="h-full flex" style={{ fontSize: '8px' }}>
          <div className="flex flex-col items-center justify-center" style={{ width: '50%' }}>
            <svg ref={barcodeRef} />
          </div>
          <div className="flex-1 flex flex-col justify-center pl-1">
            <div className="font-black text-lg">{labelData.blood_group || 'N/A'}</div>
            <div className="text-[7px]">{componentTypeDisplay}</div>
            <div className="text-[7px]">Exp: {labelData.expiry_date || '-'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
