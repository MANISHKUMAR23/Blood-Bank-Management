import React, { useState, useEffect, useCallback } from 'react';
import { inventoryEnhancedAPI, labelAPI, requestAPI, relationshipAPI } from '../lib/api';
import { toast } from 'sonner';
import { 
  Package, Thermometer, Clock, AlertTriangle, Printer, RefreshCw, 
  Search, Grid3X3, List, MapPin, Droplet, Layers, Activity, 
  ArrowRightLeft, BookmarkPlus, FileText, History, ScanLine,
  ChevronRight, X, Check, Filter, Download, Eye, GitBranch, GripVertical
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import LabelPrintDialog from '../components/LabelPrintDialog';
import BulkLabelPrintDialog from '../components/BulkLabelPrintDialog';
import BarcodeScanner from '../components/BarcodeScanner';
import ComponentRelationshipView from '../components/ComponentRelationshipView';

// View mode constants
const VIEW_MODES = {
  STORAGE: 'storage',
  BLOOD_GROUP: 'blood_group',
  COMPONENT_TYPE: 'component_type',
  EXPIRY: 'expiry',
  STATUS: 'status',
};

// Status colors
const STATUS_COLORS = {
  ready_to_use: 'bg-emerald-100 text-emerald-700',
  reserved: 'bg-cyan-100 text-cyan-700',
  quarantine: 'bg-red-100 text-red-700',
  processing: 'bg-amber-100 text-amber-700',
  collected: 'bg-slate-100 text-slate-700',
};

// Expiry colors
const getExpiryColor = (daysRemaining) => {
  if (daysRemaining === null || daysRemaining === undefined) return 'text-slate-500';
  if (daysRemaining < 0) return 'text-red-600 bg-red-50';
  if (daysRemaining < 3) return 'text-red-600 bg-red-50 font-bold';
  if (daysRemaining < 7) return 'text-orange-600 bg-orange-50';
  if (daysRemaining < 14) return 'text-amber-600 bg-amber-50';
  return 'text-slate-600';
};

// Occupancy colors
const getOccupancyColor = (percent) => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

export default function InventoryEnhanced() {
  // State
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(VIEW_MODES.STORAGE);
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' or 'list'
  const [data, setData] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBloodGroups, setSelectedBloodGroups] = useState([]);
  const [selectedComponentTypes, setSelectedComponentTypes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Selection
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Dialogs
  const [showStorageDialog, setShowStorageDialog] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState(null);
  const [storageContents, setStorageContents] = useState(null);
  
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveForm, setMoveForm] = useState({ destination: '', reason: '', notes: '' });
  const [availableStorages, setAvailableStorages] = useState([]);
  
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [reserveForm, setReserveForm] = useState({ reserved_for: '', reserved_until: '', request_id: '', notes: '' });
  const [availableRequests, setAvailableRequests] = useState([]);
  
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [quickSearchResult, setQuickSearchResult] = useState(null);
  
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditData, setAuditData] = useState(null);
  
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [reportType, setReportType] = useState('stock');
  const [reportData, setReportData] = useState(null);
  
  const [showReservedDialog, setShowReservedDialog] = useState(false);
  const [reservedItems, setReservedItems] = useState([]);
  
  // Label printing
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showBulkLabelDialog, setShowBulkLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);
  
  // Barcode Scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [bulkScanMode, setBulkScanMode] = useState(false);
  
  // Component Relationship View
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false);
  const [relationshipItemId, setRelationshipItemId] = useState(null);
  
  // Item Detail Panel
  const [showItemDetailDialog, setShowItemDetailDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Advanced Search
  const [advancedSearchLoading, setAdvancedSearchLoading] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    blood_groups: [],
    component_types: [],
    statuses: [],
    expiry_from: '',
    expiry_to: '',
  });
  
  // Drag and Drop
  const [activeId, setActiveId] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  
  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch data based on view mode
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      switch (viewMode) {
        case VIEW_MODES.STORAGE:
          response = await inventoryEnhancedAPI.getByStorage();
          break;
        case VIEW_MODES.BLOOD_GROUP:
          response = await inventoryEnhancedAPI.getByBloodGroup();
          break;
        case VIEW_MODES.COMPONENT_TYPE:
          response = await inventoryEnhancedAPI.getByComponentType();
          break;
        case VIEW_MODES.EXPIRY:
          response = await inventoryEnhancedAPI.getByExpiry();
          break;
        case VIEW_MODES.STATUS:
          response = await inventoryEnhancedAPI.getByStatus();
          break;
        default:
          response = await inventoryEnhancedAPI.getByStorage();
      }
      setData(response.data);
    } catch (error) {
      toast.error('Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick search
  const handleQuickSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await inventoryEnhancedAPI.locate(searchQuery.trim());
      setQuickSearchResult(response.data);
      if (!response.data.found) {
        toast.error('Item not found');
      }
    } catch (error) {
      toast.error('Search failed');
    }
  };

  // Open storage contents
  const handleOpenStorage = async (storage) => {
    setSelectedStorage(storage);
    try {
      const response = await inventoryEnhancedAPI.getStorageContents(storage.id);
      setStorageContents(response.data);
      setShowStorageDialog(true);
    } catch (error) {
      toast.error('Failed to load storage contents');
    }
  };

  // Move items
  const handleMove = async () => {
    if (!moveForm.destination || !moveForm.reason) {
      toast.error('Please select destination and reason');
      return;
    }
    
    try {
      const itemType = selectedItems[0]?.item_type || 'component';
      const itemIds = selectedItems.map(i => i.id || i.unit_id || i.component_id);
      
      const response = await inventoryEnhancedAPI.moveItems({
        item_ids: itemIds,
        item_type: itemType,
        destination_storage_id: moveForm.destination,
        reason: moveForm.reason,
        notes: moveForm.notes,
      });
      
      if (response.data.moved_count > 0) {
        toast.success(`Moved ${response.data.moved_count} items to ${response.data.destination}`);
        setShowMoveDialog(false);
        setSelectedItems([]);
        setMoveForm({ destination: '', reason: '', notes: '' });
        fetchData();
        if (selectedStorage) {
          handleOpenStorage(selectedStorage);
        }
      }
      
      if (response.data.failed_count > 0) {
        toast.error(`Failed to move ${response.data.failed_count} items`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Move failed');
    }
  };

  // Reserve items
  const handleReserve = async () => {
    if (!reserveForm.reserved_for) {
      toast.error('Please specify who this is reserved for');
      return;
    }
    
    try {
      const itemType = selectedItems[0]?.item_type || 'component';
      const itemIds = selectedItems.map(i => i.id || i.unit_id || i.component_id);
      
      const response = await inventoryEnhancedAPI.reserveItems({
        item_ids: itemIds,
        item_type: itemType,
        reserved_for: reserveForm.reserved_for,
        reserved_until: reserveForm.reserved_until || undefined,
        request_id: reserveForm.request_id || undefined,
        notes: reserveForm.notes,
      });
      
      if (response.data.reserved_count > 0) {
        toast.success(`Reserved ${response.data.reserved_count} items`);
        setShowReserveDialog(false);
        setSelectedItems([]);
        setReserveForm({ reserved_for: '', reserved_until: '', request_id: '', notes: '' });
        fetchData();
      }
      
      if (response.data.failed_count > 0) {
        toast.error(`Failed to reserve ${response.data.failed_count} items`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reserve failed');
    }
  };

  // Release reservation
  const handleReleaseReservation = async (item) => {
    try {
      await inventoryEnhancedAPI.releaseReservation(
        item.id || item.unit_id || item.component_id,
        item.item_type || 'component'
      );
      toast.success('Reservation released');
      fetchReservedItems();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to release reservation');
    }
  };

  // Fetch reserved items
  const fetchReservedItems = async () => {
    try {
      const response = await inventoryEnhancedAPI.getReservedItems();
      setReservedItems(response.data);
    } catch (error) {
      toast.error('Failed to fetch reserved items');
    }
  };

  // View audit trail
  const handleViewAudit = async (itemId) => {
    try {
      const response = await inventoryEnhancedAPI.getAuditTrail(itemId);
      setAuditData(response.data);
      setShowAuditDialog(true);
    } catch (error) {
      toast.error('Failed to fetch audit trail');
    }
  };

  // Fetch report
  const fetchReport = async (type) => {
    setReportType(type);
    setReportData(null);
    try {
      let response;
      switch (type) {
        case 'stock':
          response = await inventoryEnhancedAPI.getStockReport();
          break;
        case 'movement':
          response = await inventoryEnhancedAPI.getMovementReport({});
          break;
        case 'expiry':
          response = await inventoryEnhancedAPI.getExpiryAnalysis();
          break;
        case 'utilization':
          response = await inventoryEnhancedAPI.getStorageUtilization();
          break;
        default:
          response = await inventoryEnhancedAPI.getStockReport();
      }
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to fetch report');
    }
  };

  // Print label
  const handlePrintLabel = async (item) => {
    try {
      const isComponent = item.item_type === 'component' || item.component_id;
      const response = isComponent
        ? await labelAPI.getComponentLabel(item.component_id || item.id)
        : await labelAPI.getBloodUnitLabel(item.unit_id || item.id);
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      toast.error('Failed to fetch label data');
    }
  };

  // Open move dialog
  const openMoveDialog = async () => {
    try {
      const response = await inventoryEnhancedAPI.getByStorage();
      setAvailableStorages(response.data);
      setShowMoveDialog(true);
    } catch (error) {
      toast.error('Failed to load storage locations');
    }
  };

  // Open reserve dialog
  const openReserveDialog = async () => {
    try {
      const response = await requestAPI.getAll({ status: 'approved' });
      setAvailableRequests(response.data || []);
      setShowReserveDialog(true);
    } catch (error) {
      setShowReserveDialog(true);
    }
  };

  // Handle barcode scan result
  const handleBarcodeScan = async (result) => {
    if (Array.isArray(result)) {
      // Bulk scan mode - add all scanned items to selection
      for (const barcode of result) {
        try {
          const response = await inventoryEnhancedAPI.locate(barcode);
          if (response.data.found) {
            setQuickSearchResult(response.data);
            toast.success(`Found: ${barcode}`);
          }
        } catch (error) {
          toast.error(`Not found: ${barcode}`);
        }
      }
    } else {
      // Single scan mode - search and display result
      try {
        const response = await inventoryEnhancedAPI.locate(result);
        setQuickSearchResult(response.data);
        if (!response.data.found) {
          toast.error('Item not found');
        }
      } catch (error) {
        toast.error('Search failed');
      }
    }
  };

  // View component-unit relationship
  const handleViewRelationship = (item) => {
    const itemId = item.id || item.unit_id || item.component_id;
    setRelationshipItemId(itemId);
    setShowRelationshipDialog(true);
  };

  // Drag and Drop handlers
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    // Find the dragged item from storage contents or other sources
    if (storageContents?.items) {
      const item = storageContents.items.find(i => 
        (i.id || i.unit_id || i.component_id) === active.id
      );
      setDraggedItem(item);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedItem(null);
    
    if (!over || active.id === over.id) return;
    
    // Get the target storage from the droppable ID
    const targetStorageId = over.id;
    const itemId = active.id;
    
    // Find the item being dragged
    const item = storageContents?.items?.find(i => 
      (i.id || i.unit_id || i.component_id) === itemId
    );
    
    if (!item) return;
    
    // Perform move operation
    try {
      const response = await inventoryEnhancedAPI.moveItems({
        item_ids: [item.id || item.unit_id || item.component_id],
        item_type: item.item_type || (item.unit_id ? 'unit' : 'component'),
        destination_storage_id: targetStorageId,
        reason: 'space_mgmt',
        notes: 'Moved via drag-and-drop',
      });
      
      if (response.data.moved_count > 0) {
        toast.success(`Moved to ${response.data.destination}`);
        fetchData();
        if (selectedStorage) {
          handleOpenStorage(selectedStorage);
        }
      } else if (response.data.failed?.length > 0) {
        toast.error(response.data.failed[0].reason || 'Move failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Move failed');
    }
  };

  // Toggle item selection
  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const itemId = item.id || item.unit_id || item.component_id;
      const exists = prev.find(i => (i.id || i.unit_id || i.component_id) === itemId);
      if (exists) {
        return prev.filter(i => (i.id || i.unit_id || i.component_id) !== itemId);
      }
      return [...prev, item];
    });
  };

  // Select all in storage
  const selectAllInStorage = (items) => {
    const availableItems = items.filter(i => i.status === 'ready_to_use');
    setSelectedItems(availableItems);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" data-testid="inventory-enhanced-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Comprehensive blood stock monitoring and management</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchReservedItems(); setShowReservedDialog(true); }}>
            <BookmarkPlus className="w-4 h-4 mr-1" />
            Reserved
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowReportsDialog(true); fetchReport('stock'); }}>
            <FileText className="w-4 h-4 mr-1" />
            Reports
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBulkLabelDialog(true)}>
            <Printer className="w-4 h-4 mr-1" />
            Bulk Print
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Quick Search */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by Unit ID, Barcode, Donor ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleQuickSearch} className="bg-teal-600 hover:bg-teal-700">
              <Search className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowBarcodeScanner(true)} title="Scan Barcode">
              <ScanLine className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowSearchDialog(true)}>
              <Filter className="w-4 h-4 mr-1" />
              Advanced
            </Button>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">View:</span>
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VIEW_MODES.STORAGE}>
                  <span className="flex items-center"><MapPin className="w-4 h-4 mr-2" />By Storage</span>
                </SelectItem>
                <SelectItem value={VIEW_MODES.BLOOD_GROUP}>
                  <span className="flex items-center"><Droplet className="w-4 h-4 mr-2" />By Blood Group</span>
                </SelectItem>
                <SelectItem value={VIEW_MODES.COMPONENT_TYPE}>
                  <span className="flex items-center"><Layers className="w-4 h-4 mr-2" />By Component</span>
                </SelectItem>
                <SelectItem value={VIEW_MODES.EXPIRY}>
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-2" />By Expiry (FEFO)</span>
                </SelectItem>
                <SelectItem value={VIEW_MODES.STATUS}>
                  <span className="flex items-center"><Activity className="w-4 h-4 mr-2" />By Status</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Grid/List Toggle */}
            <div className="flex border rounded-lg">
              <Button
                variant={displayMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={displayMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Search Result */}
        {quickSearchResult && quickSearchResult.found && (
          <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MapPin className="w-6 h-6 text-teal-600" />
              <div>
                <p className="font-medium text-teal-800">{quickSearchResult.location?.display}</p>
                <p className="text-sm text-teal-600">
                  {quickSearchResult.item_type === 'unit' ? 'Blood Unit' : 'Component'}: {quickSearchResult.item?.unit_id || quickSearchResult.item?.component_id}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleViewRelationship(quickSearchResult.item)}>
                <GitBranch className="w-4 h-4 mr-1" />
                Relationships
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleViewAudit(quickSearchResult.item?.id)}>
                <History className="w-4 h-4 mr-1" />
                Audit Trail
              </Button>
              <Button size="sm" variant="outline" onClick={() => handlePrintLabel(quickSearchResult.item)}>
                <Printer className="w-4 h-4 mr-1" />
                Print Label
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setQuickSearchResult(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Bulk Actions Bar */}
      {selectedItems.length > 0 && (
        <Card className="p-3 bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-teal-100 text-teal-700">{selectedItems.length} selected</Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])}>
                Clear Selection
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openMoveDialog}>
                <ArrowRightLeft className="w-4 h-4 mr-1" />
                Move
              </Button>
              <Button size="sm" variant="outline" onClick={openReserveDialog}>
                <BookmarkPlus className="w-4 h-4 mr-1" />
                Reserve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowBulkLabelDialog(true)}>
                <Printer className="w-4 h-4 mr-1" />
                Print Labels
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Based on View Mode */}
      {viewMode === VIEW_MODES.STORAGE && (
        <StorageView 
          data={data} 
          displayMode={displayMode} 
          onOpenStorage={handleOpenStorage}
        />
      )}

      {viewMode === VIEW_MODES.BLOOD_GROUP && (
        <BloodGroupView 
          data={data} 
          displayMode={displayMode}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onPrintLabel={handlePrintLabel}
          onViewAudit={handleViewAudit}
        />
      )}

      {viewMode === VIEW_MODES.COMPONENT_TYPE && (
        <ComponentTypeView 
          data={data} 
          displayMode={displayMode}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onPrintLabel={handlePrintLabel}
          onViewAudit={handleViewAudit}
        />
      )}

      {viewMode === VIEW_MODES.EXPIRY && (
        <ExpiryView 
          data={data}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onPrintLabel={handlePrintLabel}
          onViewAudit={handleViewAudit}
        />
      )}

      {viewMode === VIEW_MODES.STATUS && (
        <StatusView 
          data={data}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onPrintLabel={handlePrintLabel}
          onViewAudit={handleViewAudit}
        />
      )}

      {/* Storage Contents Dialog */}
      <Dialog open={showStorageDialog} onOpenChange={setShowStorageDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              {selectedStorage?.storage_name} Contents
            </DialogTitle>
            <DialogDescription>
              {storageContents?.total || 0} items • {selectedStorage?.storage_type} • Capacity: {selectedStorage?.current_occupancy}/{selectedStorage?.capacity}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 mb-4">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => selectAllInStorage(storageContents?.items || [])}
            >
              Select Available
            </Button>
            {selectedItems.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={openMoveDialog}>
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Move ({selectedItems.length})
                </Button>
                <Button size="sm" variant="outline" onClick={openReserveDialog}>
                  <BookmarkPlus className="w-4 h-4 mr-1" />
                  Reserve ({selectedItems.length})
                </Button>
              </>
            )}
          </div>
          
          <ScrollArea className="h-[400px]">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storageContents?.items?.map((item) => {
                  const itemId = item.id || item.unit_id || item.component_id;
                  const isSelected = selectedItems.some(i => (i.id || i.unit_id || i.component_id) === itemId);
                  
                  return (
                    <TableRow key={itemId} className={isSelected ? 'bg-teal-50' : ''}>
                      <TableCell>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleItemSelection(item)}
                          disabled={item.status !== 'ready_to_use'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.item_id}</TableCell>
                      <TableCell className="capitalize">{item.component_type?.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <span className="blood-group-badge">
                          {item.blood_group || item.confirmed_blood_group || '-'}
                        </span>
                      </TableCell>
                      <TableCell>{item.volume} mL</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[item.status] || 'bg-slate-100'}>
                          {item.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs ${getExpiryColor(item.days_remaining)}`}>
                          {item.days_remaining !== null ? `${item.days_remaining}d` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleViewRelationship(item)} title="View Relationships">
                            <GitBranch className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handlePrintLabel(item)} title="Print Label">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleViewAudit(item.id)} title="Audit Trail">
                            <History className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-teal-600" />
              Move Items
            </DialogTitle>
            <DialogDescription>
              Moving {selectedItems.length} item(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Location</Label>
              <Input 
                value={selectedItems[0]?.storage_location || 'Unknown'} 
                disabled 
                className="bg-slate-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Destination Storage *</Label>
              <Select value={moveForm.destination} onValueChange={(v) => setMoveForm(f => ({ ...f, destination: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {availableStorages.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.occupancy_percent >= 100}>
                      <span className="flex items-center justify-between w-full">
                        <span>{s.storage_name}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({s.capacity - s.current_occupancy} available)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={moveForm.reason} onValueChange={(v) => setMoveForm(f => ({ ...f, reason: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temp_optimization">Temperature Optimization</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="space_mgmt">Space Management</SelectItem>
                  <SelectItem value="qc">QC Related</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={moveForm.notes}
                onChange={(e) => setMoveForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            <Button onClick={handleMove} className="bg-teal-600 hover:bg-teal-700">
              Move {selectedItems.length} Item(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserve Dialog */}
      <Dialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-teal-600" />
              Reserve Items
            </DialogTitle>
            <DialogDescription>
              Reserving {selectedItems.length} item(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {availableRequests.length > 0 && (
              <div className="space-y-2">
                <Label>Link to Request (Optional)</Label>
                <Select value={reserveForm.request_id} onValueChange={(v) => setReserveForm(f => ({ ...f, request_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approved request" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.request_id} - {r.hospital_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Reserved For *</Label>
              <Input 
                value={reserveForm.reserved_for}
                onChange={(e) => setReserveForm(f => ({ ...f, reserved_for: e.target.value }))}
                placeholder="Hospital name, patient ID, or request reference"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Reserved Until (Default: 24 hours)</Label>
              <Input 
                type="datetime-local"
                value={reserveForm.reserved_until}
                onChange={(e) => setReserveForm(f => ({ ...f, reserved_until: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={reserveForm.notes}
                onChange={(e) => setReserveForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReserveDialog(false)}>Cancel</Button>
            <Button onClick={handleReserve} className="bg-teal-600 hover:bg-teal-700">
              Reserve {selectedItems.length} Item(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserved Items Dialog */}
      <Dialog open={showReservedDialog} onOpenChange={setShowReservedDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-teal-600" />
              Reserved Items
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {reservedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No reserved items</div>
            ) : (
              <Table className="table-dense">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Reserved For</TableHead>
                    <TableHead>Time Remaining</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservedItems.map((item) => (
                    <TableRow key={item.id} className={item.is_expired ? 'bg-red-50' : ''}>
                      <TableCell className="font-mono text-xs">{item.item_id}</TableCell>
                      <TableCell className="capitalize">{item.component_type?.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <span className="blood-group-badge">{item.blood_group || '-'}</span>
                      </TableCell>
                      <TableCell>{item.reserved_for}</TableCell>
                      <TableCell>
                        {item.is_expired ? (
                          <Badge className="bg-red-100 text-red-700">Expired</Badge>
                        ) : (
                          <span className="text-sm">{item.time_remaining_hours?.toFixed(1)}h</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleReleaseReservation(item)}>
                          Release
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600" />
              Audit Trail
            </DialogTitle>
            <DialogDescription>
              {auditData?.item_type === 'unit' ? 'Blood Unit' : 'Component'}: {auditData?.item?.unit_id || auditData?.item?.component_id}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 p-2">
              {auditData?.audit_trail?.map((event, idx) => (
                <div key={idx} className="flex gap-4 pb-4 border-b last:border-b-0">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-teal-500"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.description}</span>
                      <span className="text-xs text-slate-500">
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : '-'}
                      </span>
                    </div>
                    {event.details && (
                      <div className="mt-1 text-sm text-slate-600">
                        {event.details.from && event.details.to && (
                          <div>{event.details.from} → {event.details.to}</div>
                        )}
                        {event.details.reason && <div>Reason: {event.details.reason}</div>}
                        {event.details.notes && <div className="italic">{event.details.notes}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditDialog(false)}>Close</Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reports Dialog */}
      <Dialog open={showReportsDialog} onOpenChange={setShowReportsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Inventory Reports
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={reportType} onValueChange={(v) => fetchReport(v)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="stock">Current Stock</TabsTrigger>
              <TabsTrigger value="movement">Movement</TabsTrigger>
              <TabsTrigger value="expiry">Expiry Analysis</TabsTrigger>
              <TabsTrigger value="utilization">Utilization</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[400px] mt-4">
              {reportType === 'stock' && reportData && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="text-2xl font-bold text-teal-600">{reportData.summary?.total_units}</div>
                      <div className="text-sm text-slate-500">Blood Units</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-2xl font-bold text-teal-600">{reportData.summary?.total_components}</div>
                      <div className="text-sm text-slate-500">Components</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-2xl font-bold text-teal-600">{reportData.summary?.total_items}</div>
                      <div className="text-sm text-slate-500">Total Items</div>
                    </Card>
                  </div>
                  
                  {/* By Blood Group */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">By Blood Group</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(reportData.by_blood_group?.units || {}).map(([bg, data]) => (
                        <div key={bg} className="p-2 bg-slate-50 rounded text-center">
                          <span className="blood-group-badge">{bg}</span>
                          <div className="text-lg font-bold mt-1">{data.count}</div>
                          <div className="text-xs text-slate-500">{data.volume} mL</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
              
              {reportType === 'expiry' && reportData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-3">
                    {['expired', 'expiring_3_days', 'expiring_7_days', 'expiring_14_days', 'expiring_30_days'].map((key) => (
                      <Card key={key} className={`p-3 ${key === 'expired' ? 'bg-red-50 border-red-200' : key.includes('3_days') ? 'bg-orange-50 border-orange-200' : ''}`}>
                        <div className="text-xl font-bold">{reportData.summary?.[key] || 0}</div>
                        <div className="text-xs text-slate-600 capitalize">{key.replace(/_/g, ' ')}</div>
                      </Card>
                    ))}
                  </div>
                  
                  {reportData.categories?.critical?.total > 0 && (
                    <Card className="p-4 border-red-200 bg-red-50">
                      <h3 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Critical: Expiring within 3 days ({reportData.categories.critical.total})
                      </h3>
                      <Table className="table-dense">
                        <TableBody>
                          {[...reportData.categories.critical.units, ...reportData.categories.critical.components].slice(0, 10).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{item.unit_id || item.component_id}</TableCell>
                              <TableCell>{item.blood_group || item.confirmed_blood_group}</TableCell>
                              <TableCell>{item.expiry_date}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </div>
              )}
              
              {reportType === 'utilization' && reportData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-3">
                      <div className="text-xl font-bold">{reportData.summary?.total_capacity}</div>
                      <div className="text-xs text-slate-500">Total Capacity</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xl font-bold">{reportData.summary?.total_occupancy}</div>
                      <div className="text-xs text-slate-500">Total Occupied</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xl font-bold">{reportData.summary?.overall_utilization}%</div>
                      <div className="text-xs text-slate-500">Overall Utilization</div>
                    </Card>
                    <Card className="p-3 bg-red-50">
                      <div className="text-xl font-bold text-red-600">{reportData.summary?.critical_count}</div>
                      <div className="text-xs text-slate-500">Critical (&gt;90%)</div>
                    </Card>
                  </div>
                  
                  <Table className="table-dense">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Storage</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Occupied</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.locations?.map((loc) => (
                        <TableRow key={loc.id}>
                          <TableCell className="font-medium">{loc.storage_name}</TableCell>
                          <TableCell className="capitalize">{loc.storage_type}</TableCell>
                          <TableCell>{loc.capacity}</TableCell>
                          <TableCell>{loc.occupancy}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={loc.utilization_percent} className="w-20 h-2" />
                              <span className="text-xs">{loc.utilization_percent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              loc.status === 'critical' ? 'bg-red-100 text-red-700' :
                              loc.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                              loc.status === 'underutilized' ? 'bg-cyan-100 text-cyan-700' :
                              'bg-emerald-100 text-emerald-700'
                            }>
                              {loc.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {reportType === 'movement' && reportData && (
                <div className="space-y-4">
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Total Movements: {reportData.total_movements}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-600 mb-2">By Reason</h4>
                        {Object.entries(reportData.by_reason || {}).map(([reason, count]) => (
                          <div key={reason} className="flex justify-between py-1 border-b">
                            <span className="capitalize">{reason.replace('_', ' ')}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </ScrollArea>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportsDialog(false)}>Close</Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Export Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Print Dialog */}
      <LabelPrintDialog 
        open={showLabelDialog}
        onOpenChange={setShowLabelDialog}
        labelData={labelData}
      />

      {/* Bulk Label Print Dialog */}
      <BulkLabelPrintDialog 
        open={showBulkLabelDialog}
        onOpenChange={setShowBulkLabelDialog}
        items={selectedItems.length > 0 ? selectedItems : (storageContents?.items || [])}
      />

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner 
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onScan={handleBarcodeScan}
        bulkMode={bulkScanMode}
        title={bulkScanMode ? 'Bulk Barcode Scan' : 'Scan Barcode'}
      />

      {/* Component Relationship View Dialog */}
      <ComponentRelationshipView 
        open={showRelationshipDialog}
        onOpenChange={setShowRelationshipDialog}
        itemId={relationshipItemId}
      />
    </div>
  );
}

// ============ VIEW COMPONENTS ============

function StorageView({ data, displayMode, onOpenStorage }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-center py-8 text-slate-500">No storage locations found</div>;
  }

  if (displayMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((storage) => (
          <DroppableStorageCard 
            key={storage.id}
            storage={storage}
            onOpenStorage={onOpenStorage}
          />
        ))}
      </div>
    );
  }

  // List view
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Storage</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Occupancy</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Components</TableHead>
            <TableHead>Expiring</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((storage) => (
            <TableRow key={storage.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenStorage(storage)}>
              <TableCell className="font-medium">{storage.storage_name}</TableCell>
              <TableCell className="capitalize">{storage.storage_type}</TableCell>
              <TableCell>{storage.capacity}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={storage.occupancy_percent} className="w-16 h-2" />
                  <span className={`text-xs ${storage.occupancy_percent >= 90 ? 'text-red-600 font-bold' : ''}`}>
                    {storage.occupancy_percent}%
                  </span>
                </div>
              </TableCell>
              <TableCell>{storage.units_count}</TableCell>
              <TableCell>{storage.components_count}</TableCell>
              <TableCell>
                <span className={storage.expiring_count > 0 ? 'text-amber-600 font-bold' : ''}>
                  {storage.expiring_count}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BloodGroupView({ data, displayMode, selectedItems, onToggleSelect, onPrintLabel, onViewAudit }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((group) => (
        <Card key={group.blood_group}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="blood-group-badge text-lg">{group.blood_group}</span>
              <span className="text-2xl font-bold text-teal-600">{group.total_items}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Whole Blood Units:</span>
                <span className="font-medium">{group.units_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Components:</span>
                <span className="font-medium">{group.components_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Volume:</span>
                <span className="font-medium">{group.total_volume?.toLocaleString()} mL</span>
              </div>
              
              {/* Component breakdown */}
              {Object.entries(group.components_by_type || {}).length > 0 && (
                <div className="pt-2 border-t">
                  {Object.entries(group.components_by_type).map(([type, items]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="capitalize text-slate-500">{type.replace('_', ' ')}:</span>
                      <span>{items.length}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ComponentTypeView({ data, displayMode, selectedItems, onToggleSelect, onPrintLabel, onViewAudit }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((type) => (
        <Card key={type.component_type}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base capitalize">{type.display_name}</CardTitle>
              <span className="text-2xl font-bold text-teal-600">{type.count}</span>
            </div>
            <CardDescription className="flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              {type.storage_temp}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Volume:</span>
              <span className="font-medium">{type.total_volume?.toLocaleString()} mL</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExpiryView({ data, selectedItems, onToggleSelect, onPrintLabel, onViewAudit }) {
  if (!data) return null;

  const { summary, categories } = data;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <Card className={`p-3 ${summary?.expired > 0 ? 'bg-red-100 border-red-300' : ''}`}>
          <div className={`text-2xl font-bold ${summary?.expired > 0 ? 'text-red-600' : ''}`}>{summary?.expired || 0}</div>
          <div className="text-xs text-slate-600">Expired</div>
        </Card>
        <Card className={`p-3 ${summary?.critical > 0 ? 'bg-red-50 border-red-200' : ''}`}>
          <div className={`text-2xl font-bold ${summary?.critical > 0 ? 'text-red-600' : ''}`}>{summary?.critical || 0}</div>
          <div className="text-xs text-slate-600">&lt;3 Days</div>
        </Card>
        <Card className="p-3 bg-orange-50 border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{summary?.warning || 0}</div>
          <div className="text-xs text-slate-600">3-7 Days</div>
        </Card>
        <Card className="p-3 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{summary?.caution || 0}</div>
          <div className="text-xs text-slate-600">7-14 Days</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-emerald-600">{summary?.normal || 0}</div>
          <div className="text-xs text-slate-600">&gt;14 Days</div>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Days Left</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items?.slice(0, 50).map((item) => {
              const itemId = item.id || item.unit_id || item.component_id;
              const isSelected = selectedItems?.some(i => (i.id || i.unit_id || i.component_id) === itemId);
              
              return (
                <TableRow key={itemId} className={`${isSelected ? 'bg-teal-50' : ''} ${item.expiry_category === 'expired' ? 'bg-red-50' : item.expiry_category === 'critical' ? 'bg-red-50/50' : ''}`}>
                  <TableCell>
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item)}
                      disabled={item.status !== 'ready_to_use'}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.item_id}</TableCell>
                  <TableCell className="capitalize">{item.component_type?.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <span className="blood-group-badge">{item.blood_group || item.confirmed_blood_group || '-'}</span>
                  </TableCell>
                  <TableCell>{item.volume} mL</TableCell>
                  <TableCell>{item.expiry_date}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getExpiryColor(item.days_remaining)}`}>
                      {item.days_remaining < 0 ? 'EXPIRED' : `${item.days_remaining}d`}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{item.storage_location || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onPrintLabel(item)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onViewAudit(item.id)}>
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatusView({ data, selectedItems, onToggleSelect, onPrintLabel, onViewAudit }) {
  if (!data) return null;

  return (
    <Tabs defaultValue="ready_to_use">
      <TabsList>
        {data.map((status) => (
          <TabsTrigger key={status.status} value={status.status}>
            {status.display_name} ({status.total_count})
          </TabsTrigger>
        ))}
      </TabsList>
      
      {data.map((status) => (
        <TabsContent key={status.status} value={status.status}>
          <Card>
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...status.units, ...status.components].slice(0, 50).map((item) => {
                  const itemId = item.id || item.unit_id || item.component_id;
                  const isSelected = selectedItems?.some(i => (i.id || i.unit_id || i.component_id) === itemId);
                  const isUnit = !!item.unit_id;
                  
                  return (
                    <TableRow key={itemId} className={isSelected ? 'bg-teal-50' : ''}>
                      <TableCell>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect({ ...item, item_type: isUnit ? 'unit' : 'component' })}
                          disabled={item.status !== 'ready_to_use'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.unit_id || item.component_id}</TableCell>
                      <TableCell className="capitalize">{isUnit ? 'Whole Blood' : item.component_type?.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <span className="blood-group-badge">{item.blood_group || item.confirmed_blood_group || '-'}</span>
                      </TableCell>
                      <TableCell>{item.volume} mL</TableCell>
                      <TableCell className="text-xs">{item.storage_location || item.current_location || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => onPrintLabel({ ...item, item_type: isUnit ? 'unit' : 'component' })}>
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onViewAudit(item.id)}>
                            <History className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Droppable Storage Card for Drag-and-Drop
function DroppableStorageCard({ storage, onOpenStorage }) {
  const { isOver, setNodeRef } = useDroppable({
    id: storage.id,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`cursor-pointer transition-all ${
        isOver 
          ? 'ring-2 ring-teal-400 ring-offset-2 shadow-lg bg-teal-50' 
          : 'hover:shadow-lg'
      }`}
      onClick={() => onOpenStorage(storage)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{storage.storage_name}</CardTitle>
          <Badge variant="outline" className="capitalize">{storage.storage_type}</Badge>
        </div>
        <CardDescription>{storage.location_code}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Occupancy Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Occupancy</span>
              <span className={storage.occupancy_percent >= 90 ? 'text-red-600 font-bold' : ''}>
                {storage.current_occupancy}/{storage.capacity} ({storage.occupancy_percent}%)
              </span>
            </div>
            <Progress 
              value={storage.occupancy_percent} 
              className={`h-2 ${getOccupancyColor(storage.occupancy_percent)}`}
            />
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-bold">{storage.units_count}</div>
              <div className="text-slate-500">Units</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="font-bold">{storage.components_count}</div>
              <div className="text-slate-500">Components</div>
            </div>
            <div className={`p-2 rounded ${storage.expiring_count > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className={`font-bold ${storage.expiring_count > 0 ? 'text-amber-600' : ''}`}>
                {storage.expiring_count}
              </div>
              <div className="text-slate-500">Expiring</div>
            </div>
          </div>
          
          {/* Temperature */}
          {(storage.temp_min !== null || storage.temp_max !== null) && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Thermometer className="w-3 h-3" />
              {storage.temp_min}°C to {storage.temp_max}°C
            </div>
          )}
          
          {/* Drop indicator */}
          {isOver && (
            <div className="text-center py-2 text-teal-600 text-sm font-medium animate-pulse">
              Drop here to move
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Draggable Item Row for tables
function DraggableItemRow({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id || item.unit_id || item.component_id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={isDragging ? 'bg-teal-100' : ''}
    >
      {children}
    </tr>
  );
}
