import React, { useState, useRef } from 'react';
import { Printer, X, Eye, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import BloodPackLabel from './BloodPackLabel';

export default function BulkLabelPrintDialog({ 
  open, 
  onOpenChange, 
  items = [], // Array of blood units or components
  title = 'Bulk Print Labels'
}) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [labelSize, setLabelSize] = useState('standard');
  const printRef = useRef(null);

  // Toggle selection
  const toggleItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // Select all / deselect all
  const toggleAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id || item.unit_id));
    }
  };

  // Get label data from item
  const getLabelData = (item) => ({
    unit_id: item.unit_id || item.component_id || item.id,
    blood_group: item.confirmed_blood_group || item.blood_group,
    component_type: item.component_type || 'whole_blood',
    volume: item.volume,
    collection_date: item.collection_date,
    expiry_date: item.expiry_date,
    donor_id: item.donor_id?.slice(-8) || 'Anonymous',
    test_status: item.test_status || item.status,
    batch_number: item.batch_id || item.lot_number,
    blood_bank_name: 'BLOODLINK BLOOD BANK',
    warnings: item.warnings || [],
  });

  const handlePrint = () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print labels');
      return;
    }

    // Generate labels HTML
    const selectedItemsData = items.filter(item => 
      selectedItems.includes(item.id || item.unit_id)
    );

    let labelsHtml = '';
    selectedItemsData.forEach((item, index) => {
      const labelData = getLabelData(item);
      labelsHtml += `
        <div class="label-container">
          ${generateLabelHtml(labelData, isDuplicate, labelSize)}
        </div>
      `;
      if (index < selectedItemsData.length - 1) {
        labelsHtml += '<div style="page-break-after: always;"></div>';
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulk Labels - ${selectedItems.length} items</title>
          <style>
            @media print {
              @page {
                size: ${labelSize === 'standard' ? '4in 2in' : '2in 1in'};
                margin: 0;
              }
              body { margin: 0; padding: 0; }
              .label-container { page-break-inside: avoid; }
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
            .label-container { margin: 0 auto 20px auto; }
            .blood-pack-label {
              width: ${labelSize === 'standard' ? '400px' : '200px'};
              height: ${labelSize === 'standard' ? '200px' : '100px'};
              border: 2px solid black;
              padding: ${labelSize === 'standard' ? '8px' : '4px'};
              box-sizing: border-box;
              background: white;
              position: relative;
            }
            .duplicate-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: ${labelSize === 'standard' ? '48px' : '24px'};
              font-weight: bold;
              color: rgba(239, 68, 68, 0.3);
              letter-spacing: 4px;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate HTML for a single label (for bulk printing)
  const generateLabelHtml = (data, duplicate, size) => {
    const storageTemps = {
      whole_blood: '2-6°C', prc: '2-6°C', plasma: '≤ -25°C',
      ffp: '≤ -25°C', platelets: '20-24°C', cryoprecipitate: '≤ -25°C',
    };
    const storageTemp = storageTemps[data.component_type?.toLowerCase()] || '2-6°C';
    const componentDisplay = data.component_type?.toUpperCase().replace('_', ' ') || 'WHOLE BLOOD';

    if (size === 'small') {
      return `
        <div class="blood-pack-label">
          ${duplicate ? '<div class="duplicate-watermark">DUPLICATE</div>' : ''}
          <div style="display:flex;height:100%;font-size:8px;">
            <div style="width:50%;display:flex;align-items:center;justify-content:center;">
              <svg id="barcode-${data.unit_id}"></svg>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-left:4px;">
              <div style="font-weight:900;font-size:16px;">${data.blood_group || 'N/A'}</div>
              <div style="font-size:7px;">${componentDisplay}</div>
              <div style="font-size:7px;">Exp: ${data.expiry_date || '-'}</div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="blood-pack-label">
        ${duplicate ? '<div class="duplicate-watermark">DUPLICATE</div>' : ''}
        <div style="height:100%;display:flex;flex-direction:column;font-size:10px;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid black;padding-bottom:4px;margin-bottom:4px;">
            <div>
              <div style="font-weight:bold;font-size:12px;">${data.blood_bank_name || 'BLOOD BANK'}</div>
              <div style="font-size:8px;color:#666;">Licensed Blood Center</div>
            </div>
            <div style="font-size:24px;font-weight:900;padding:2px 8px;border:2px solid black;background:#fee2e2;">
              ${data.blood_group || 'N/A'}
            </div>
          </div>
          <div style="display:flex;flex:1;gap:8px;">
            <div style="width:45%;display:flex;align-items:center;justify-content:center;">
              <div style="font-family:monospace;font-size:12px;text-align:center;">
                ||||| ${data.unit_id} |||||<br/>
                <span style="font-size:10px;">${data.unit_id}</span>
              </div>
            </div>
            <div style="flex:1;font-size:9px;">
              <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${componentDisplay}</div>
              <div>Volume: ${data.volume || '-'} mL | Donor: ${data.donor_id || '-'}</div>
              <div>Collected: ${data.collection_date || '-'} | Batch: ${data.batch_number || '-'}</div>
              <div>Expiry: <b style="color:#dc2626;">${data.expiry_date || '-'}</b> | Storage: <b>${storageTemp}</b></div>
              <div>Test: <span style="background:${data.test_status === 'tested' || data.test_status === 'negative' ? '#10b981' : '#f59e0b'};color:white;padding:1px 4px;border-radius:2px;font-size:8px;">${(data.test_status || 'PENDING').toUpperCase()}</span></div>
            </div>
          </div>
          <div style="border-top:1px solid black;padding-top:2px;margin-top:4px;display:flex;justify-content:space-between;font-size:8px;color:#666;">
            <span>Unit: ${data.unit_id}</span>
            <span>Printed: ${new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    `;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Select items to print labels for. {items.length} items available.
          </DialogDescription>
        </DialogHeader>

        {/* Options Row */}
        <div className="flex items-center justify-between gap-4 py-3 border-b">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleAll}
            >
              {selectedItems.length === items.length ? (
                <><CheckSquare className="w-4 h-4 mr-1" /> Deselect All</>
              ) : (
                <><Square className="w-4 h-4 mr-1" /> Select All ({items.length})</>
              )}
            </Button>
            <Badge variant="outline">
              {selectedItems.length} selected
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Size:</Label>
              <Select value={labelSize} onValueChange={setLabelSize}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">4" x 2"</SelectItem>
                  <SelectItem value="small">2" x 1"</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isDuplicate} onCheckedChange={setIsDuplicate} />
              <Label className="text-sm">Duplicate</Label>
            </div>
          </div>
        </div>

        {/* Items List */}
        <ScrollArea className="h-[350px] border rounded-lg">
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const id = item.id || item.unit_id;
              const isSelected = selectedItems.includes(id);
              return (
                <div 
                  key={id}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-teal-50 border border-teal-200' 
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  onClick={() => toggleItem(id)}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
                    <span className="font-mono">{item.unit_id || item.component_id}</span>
                    <Badge className="w-fit">
                      {item.confirmed_blood_group || item.blood_group || '-'}
                    </Badge>
                    <span className="capitalize text-slate-600">
                      {item.component_type?.replace('_', ' ') || 'Whole Blood'}
                    </span>
                    <span className="text-slate-600">{item.volume} mL</span>
                    <span className="text-slate-500">{item.expiry_date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button 
            onClick={handlePrint}
            className="bg-teal-600 hover:bg-teal-700"
            disabled={selectedItems.length === 0}
          >
            <Printer className="w-4 h-4 mr-1" />
            Print {selectedItems.length} Label{selectedItems.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
