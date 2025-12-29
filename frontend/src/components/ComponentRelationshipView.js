import React, { useState, useEffect } from 'react';
import { relationshipAPI, labelAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  GitBranch, Droplet, Package, Clock, MapPin, 
  CheckCircle, AlertTriangle, XCircle, Printer,
  ChevronDown, ChevronRight, Info, Beaker, User
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import LabelPrintDialog from './LabelPrintDialog';

// Status colors
const STATUS_COLORS = {
  ready_to_use: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  reserved: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Clock },
  quarantine: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  processing: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  collected: { bg: 'bg-slate-100', text: 'text-slate-700', icon: Package },
  issued: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle },
  discarded: { bg: 'bg-gray-100', text: 'text-gray-500', icon: XCircle },
};

// Component type colors
const COMPONENT_COLORS = {
  prc: 'border-red-400 bg-red-50',
  plasma: 'border-amber-400 bg-amber-50',
  ffp: 'border-yellow-400 bg-yellow-50',
  platelets: 'border-orange-400 bg-orange-50',
  cryoprecipitate: 'border-purple-400 bg-purple-50',
  whole_blood: 'border-red-600 bg-red-100',
};

export default function ComponentRelationshipView({ 
  itemId, 
  itemType = 'auto', 
  open, 
  onOpenChange,
  embedded = false // If true, renders inline without dialog wrapper
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['parent']));
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);

  useEffect(() => {
    if (itemId && (open || embedded)) {
      fetchRelationship();
    }
  }, [itemId, open, embedded]);

  const fetchRelationship = async () => {
    setLoading(true);
    try {
      const response = await relationshipAPI.getRelationshipTree(itemId, itemType);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load relationship data');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handlePrintLabel = async (item, isUnit = false) => {
    try {
      const response = isUnit
        ? await labelAPI.getBloodUnitLabel(item.unit_id || item.id)
        : await labelAPI.getComponentLabel(item.component_id || item.id);
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      toast.error('Failed to load label data');
    }
  };

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : !data ? (
        <div className="text-center py-8 text-slate-500">
          No relationship data found
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-2xl font-bold text-teal-600">{data.summary?.total_components || 0}</div>
              <div className="text-xs text-slate-500">Components</div>
            </Card>
            <Card className="p-3">
              <div className="text-2xl font-bold text-slate-600">{data.summary?.parent_volume || 0} mL</div>
              <div className="text-xs text-slate-500">Parent Volume</div>
            </Card>
            <Card className="p-3">
              <div className="text-2xl font-bold text-slate-600">{data.summary?.total_component_volume || 0} mL</div>
              <div className="text-xs text-slate-500">Component Volume</div>
            </Card>
            <Card className="p-3">
              <div className="text-2xl font-bold text-emerald-600">{data.summary?.statuses?.available || 0}</div>
              <div className="text-xs text-slate-500">Available</div>
            </Card>
          </div>

          {/* Visual Tree */}
          <div className="bg-slate-50 rounded-lg p-4">
            {/* Parent Unit Node */}
            {data.parent_unit && (
              <div className="relative">
                <ParentUnitNode 
                  unit={data.parent_unit} 
                  expanded={expandedNodes.has('parent')}
                  onToggle={() => toggleNode('parent')}
                  onPrintLabel={() => handlePrintLabel(data.parent_unit, true)}
                  isHighlighted={data.current_component_id && !data.parent_unit.is_current}
                />
                
                {/* Connection Line */}
                {expandedNodes.has('parent') && data.components?.length > 0 && (
                  <div className="ml-8 border-l-2 border-slate-300 pl-4 mt-2 space-y-2">
                    {/* Components */}
                    {data.components.map((comp, idx) => (
                      <ComponentNode 
                        key={comp.id}
                        component={comp}
                        isLast={idx === data.components.length - 1}
                        isHighlighted={data.current_component_id === comp.id}
                        onPrintLabel={() => handlePrintLabel(comp, false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Component Types Legend */}
          <div className="flex flex-wrap gap-2 justify-center pt-2 border-t">
            <span className="text-xs text-slate-500 mr-2">Component Types:</span>
            {['prc', 'plasma', 'ffp', 'platelets', 'cryoprecipitate'].map(type => (
              <Badge key={type} variant="outline" className={`text-xs ${COMPONENT_COLORS[type]}`}>
                {type.toUpperCase()}
              </Badge>
            ))}
          </div>
        </>
      )}

      {/* Label Print Dialog */}
      <LabelPrintDialog 
        open={showLabelDialog}
        onOpenChange={setShowLabelDialog}
        labelData={labelData}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-teal-600" />
            Component-Unit Relationship
          </DialogTitle>
          <DialogDescription>
            Visual relationship between blood unit and derived components
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

// Parent Unit Node Component
function ParentUnitNode({ unit, expanded, onToggle, onPrintLabel, isHighlighted }) {
  const StatusIcon = STATUS_COLORS[unit.status]?.icon || Package;
  
  return (
    <div className={`rounded-lg border-2 p-4 transition-all ${
      isHighlighted ? 'border-teal-400 bg-teal-50' : 'border-red-400 bg-white'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Expand/Collapse Button */}
          <button 
            onClick={onToggle}
            className="mt-1 p-1 hover:bg-slate-100 rounded"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Droplet className="w-6 h-6 text-red-600" />
          </div>
          
          {/* Info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg">{unit.display_id || unit.unit_id}</span>
              <Badge className="blood-group-badge">
                {unit.confirmed_blood_group || unit.blood_group || 'N/A'}
              </Badge>
            </div>
            <div className="text-sm text-slate-500">Whole Blood Unit</div>
            
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {unit.volume || 450} mL
                  </TooltipTrigger>
                  <TooltipContent>Volume</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {unit.collection_date}
                  </TooltipTrigger>
                  <TooltipContent>Collection Date</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {unit.storage_location && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {unit.storage_location}
                    </TooltipTrigger>
                    <TooltipContent>Storage Location</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {unit.donor_info && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {unit.donor_info.donor_id?.slice(-8)}
                    </TooltipTrigger>
                    <TooltipContent>Donor ID</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {unit.lab_result && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <Beaker className="w-3 h-3" />
                      <span className={unit.lab_result.overall_result === 'negative' ? 'text-emerald-600' : 'text-red-600'}>
                        {unit.lab_result.overall_result?.toUpperCase()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Lab Test Result</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
        
        {/* Status & Actions */}
        <div className="flex flex-col items-end gap-2">
          <Badge className={`${STATUS_COLORS[unit.status]?.bg} ${STATUS_COLORS[unit.status]?.text}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {unit.status?.replace('_', ' ')}
          </Badge>
          <Button size="sm" variant="ghost" onClick={onPrintLabel}>
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Component Node Component
function ComponentNode({ component, isLast, isHighlighted, onPrintLabel }) {
  const StatusIcon = STATUS_COLORS[component.status]?.icon || Package;
  const componentColor = COMPONENT_COLORS[component.component_type] || 'border-slate-300 bg-slate-50';
  
  return (
    <div className="relative">
      {/* Horizontal connector line */}
      <div className="absolute -left-4 top-6 w-4 border-t-2 border-slate-300"></div>
      
      <div className={`rounded-lg border-2 p-3 transition-all ${componentColor} ${
        isHighlighted ? 'ring-2 ring-teal-400 ring-offset-2' : ''
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              component.component_type === 'prc' ? 'bg-red-200' :
              component.component_type === 'plasma' || component.component_type === 'ffp' ? 'bg-amber-200' :
              component.component_type === 'platelets' ? 'bg-orange-200' :
              'bg-purple-200'
            }`}>
              <Package className="w-5 h-5 text-slate-700" />
            </div>
            
            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{component.display_id || component.component_id}</span>
                {component.blood_group && (
                  <Badge className="blood-group-badge text-xs">
                    {component.blood_group}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-600 capitalize font-medium">
                {component.component_type?.replace('_', ' ')}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {component.volume} mL
                </span>
                {component.expiry_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Exp: {component.expiry_date}
                  </span>
                )}
                {component.storage_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {component.storage_location}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Status & Actions */}
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs ${STATUS_COLORS[component.status]?.bg} ${STATUS_COLORS[component.status]?.text}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {component.status?.replace('_', ' ')}
            </Badge>
            <Button size="sm" variant="ghost" onClick={onPrintLabel} className="h-6 w-6 p-0">
              <Printer className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
