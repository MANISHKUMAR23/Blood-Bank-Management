import React, { useState, useRef } from 'react';
import { Printer, Copy, X, Eye, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import BloodPackLabel from './BloodPackLabel';

export default function LabelPrintDialog({ 
  open, 
  onOpenChange, 
  labelData,
  title = 'Print Blood Pack Label'
}) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [labelSize, setLabelSize] = useState('standard');
  const [copies, setCopies] = useState(1);
  const printRef = useRef(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print labels');
      return;
    }

    // Generate multiple copies if needed
    let labelsHtml = '';
    for (let i = 0; i < copies; i++) {
      labelsHtml += printContent.innerHTML;
      if (i < copies - 1) {
        labelsHtml += '<div style="page-break-after: always;"></div>';
      }
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Blood Pack Label - ${labelData?.unit_id || 'Print'}</title>
          <style>
            @media print {
              @page {
                size: ${labelSize === 'standard' ? '4in 2in' : '2in 1in'};
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
              .blood-pack-label {
                page-break-inside: avoid;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 10px;
            }
            .blood-pack-label {
              margin: 0 auto 20px auto;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!labelData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Label Info Summary */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Unit ID</p>
              <p className="font-mono font-bold text-lg">{labelData.unit_id}</p>
            </div>
            <Badge className="text-lg px-3 py-1 bg-red-100 text-red-700 border border-red-300">
              {labelData.blood_group || 'N/A'}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
            <div>
              <span className="text-slate-500">Component:</span>
              <span className="ml-1 font-medium capitalize">
                {labelData.component_type?.replace('_', ' ') || 'Whole Blood'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Volume:</span>
              <span className="ml-1 font-medium">{labelData.volume} mL</span>
            </div>
            <div>
              <span className="text-slate-500">Expiry:</span>
              <span className="ml-1 font-medium text-red-600">{labelData.expiry_date}</span>
            </div>
          </div>
        </div>

        {/* Print Options */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Label Size</Label>
            <Select value={labelSize} onValueChange={setLabelSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (4" x 2")</SelectItem>
                <SelectItem value="small">Small (2" x 1")</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Number of Copies</Label>
            <Select value={copies.toString()} onValueChange={(v) => setCopies(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'copy' : 'copies'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duplicate Label</Label>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={isDuplicate}
                onCheckedChange={setIsDuplicate}
              />
              <span className="text-sm text-slate-500">
                {isDuplicate ? 'With watermark' : 'Original'}
              </span>
            </div>
          </div>
        </div>

        {/* Label Preview */}
        <div className="border rounded-lg p-4 bg-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-600">Label Preview</span>
          </div>
          <div className="flex justify-center" ref={printRef}>
            <BloodPackLabel 
              labelData={labelData} 
              isDuplicate={isDuplicate}
              labelSize={labelSize}
            />
          </div>
        </div>

        {/* Test Status & Warnings Info */}
        {(labelData.test_status || (labelData.warnings && labelData.warnings.length > 0)) && (
          <div className="mt-4 space-y-2">
            {labelData.test_status && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Test Status:</span>
                <Badge className={`${
                  labelData.test_status === 'negative' || labelData.test_status === 'tested'
                    ? 'bg-emerald-100 text-emerald-700'
                    : labelData.test_status === 'positive'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {labelData.test_status.toUpperCase()}
                </Badge>
              </div>
            )}
            {labelData.warnings && labelData.warnings.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <strong>⚠ Warnings:</strong> {labelData.warnings.join(', ')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setIsDuplicate(true);
            }}
          >
            <Copy className="w-4 h-4 mr-1" />
            Mark as Duplicate
          </Button>
          <Button 
            onClick={handlePrint}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Printer className="w-4 h-4 mr-1" />
            Print {copies > 1 ? `${copies} Labels` : 'Label'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
