import React, { useState, useEffect } from 'react';
import { configAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Settings, FileText, GitBranch, Zap, Truck, Building2, Sliders,
  Plus, Edit, Trash2, Copy, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  GripVertical, Eye, Save, RefreshCw, Search, AlertTriangle, Check, X, Warehouse
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File' },
  { value: 'textarea', label: 'Text Area' },
];

const TRIGGER_EVENTS = [
  { value: 'on_submit', label: 'On Submit' },
  { value: 'on_field_change', label: 'On Field Change' },
  { value: 'on_status_change', label: 'On Status Change' },
  { value: 'scheduled_daily', label: 'Scheduled Daily' },
  { value: 'scheduled_weekly', label: 'Scheduled Weekly' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_equal', label: 'Greater or Equal' },
  { value: 'less_equal', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'empty', label: 'Is Empty' },
  { value: 'not_empty', label: 'Is Not Empty' },
];

const ACTION_TYPES = [
  { value: 'set_field', label: 'Set Field Value' },
  { value: 'set_status', label: 'Set Status' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_alert', label: 'Create Alert' },
  { value: 'auto_quarantine', label: 'Auto Quarantine' },
  { value: 'auto_defer', label: 'Auto Defer Donor' },
  { value: 'block_submission', label: 'Block Submission' },
];

const MODULES = [
  { value: 'donor', label: 'Donor Management' },
  { value: 'screening', label: 'Health Screening' },
  { value: 'collection', label: 'Blood Collection' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'request', label: 'Blood Requests' },
  { value: 'processing', label: 'Component Processing' },
  { value: 'qc', label: 'QC Validation' },
];

export default function Configuration() {
  const [activeTab, setActiveTab] = useState('forms');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [forms, setForms] = useState([]);
  const [rules, setRules] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [settings, setSettings] = useState({});
  const [storageTypes, setStorageTypes] = useState([]);
  
  // Dialog states
  const [showFormEditor, setShowFormEditor] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showCourierDialog, setShowCourierDialog] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showStorageTypeDialog, setShowStorageTypeDialog] = useState(false);
  
  // Edit states
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [selectedStorageType, setSelectedStorageType] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [formsRes, rulesRes, triggersRes, vehiclesRes, couriersRes, settingsRes, storageTypesRes] = await Promise.all([
        configAPI.getForms(),
        configAPI.getRules(),
        configAPI.getTriggers(),
        configAPI.getVehicles(),
        configAPI.getCouriers(),
        configAPI.getSettings(),
        configAPI.getStorageTypes(),
      ]);
      setForms(formsRes.data);
      setRules(rulesRes.data);
      setTriggers(triggersRes.data);
      setVehicles(vehiclesRes.data);
      setCouriers(couriersRes.data);
      setSettings(settingsRes.data);
      setStorageTypes(storageTypesRes.data);
    } catch (error) {
      toast.error('Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FORM BUILDER ====================
  const handleEditForm = (form) => {
    setSelectedForm({ ...form, form_schema: [...form.form_schema] });
    setShowFormEditor(true);
  };

  const handleSaveForm = async () => {
    try {
      await configAPI.updateForm(selectedForm.form_name, selectedForm.form_schema);
      toast.success('Form saved successfully');
      setShowFormEditor(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save form');
    }
  };

  const handleAddField = () => {
    setEditingField({
      name: '',
      label: '',
      field_type: 'text',
      required: false,
      options: [],
      validation: {},
      help_text: '',
      placeholder: '',
      is_system_field: false,
    });
    setShowFieldDialog(true);
  };

  const handleSaveField = () => {
    if (!editingField.name || !editingField.label) {
      toast.error('Name and Label are required');
      return;
    }
    
    const fields = [...selectedForm.form_schema];
    const existingIndex = fields.findIndex(f => f.name === editingField.name);
    
    if (existingIndex >= 0 && !editingField._isEditing) {
      toast.error('Field with this name already exists');
      return;
    }
    
    if (existingIndex >= 0) {
      fields[existingIndex] = editingField;
    } else {
      fields.push({ ...editingField, order: fields.length });
    }
    
    setSelectedForm({ ...selectedForm, form_schema: fields });
    setShowFieldDialog(false);
    setEditingField(null);
  };

  const handleDeleteField = (fieldName) => {
    const field = selectedForm.form_schema.find(f => f.name === fieldName);
    if (field?.is_system_field) {
      toast.error('Cannot delete system field');
      return;
    }
    
    const fields = selectedForm.form_schema.filter(f => f.name !== fieldName);
    setSelectedForm({ ...selectedForm, form_schema: fields });
  };

  const moveField = (index, direction) => {
    const fields = [...selectedForm.form_schema];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    fields.forEach((f, i) => f.order = i);
    
    setSelectedForm({ ...selectedForm, form_schema: fields });
  };

  // ==================== WORKFLOW RULES ====================
  const handleCreateRule = () => {
    setSelectedRule({
      rule_name: '',
      module: 'donor',
      trigger_event: 'on_submit',
      conditions: [],
      actions: [],
      priority: 0,
      is_active: true,
    });
    setShowRuleEditor(true);
  };

  const handleEditRule = (rule) => {
    setSelectedRule({ ...rule });
    setShowRuleEditor(true);
  };

  const handleSaveRule = async () => {
    if (!selectedRule.rule_name) {
      toast.error('Rule name is required');
      return;
    }
    
    try {
      if (selectedRule.id) {
        await configAPI.updateRule(selectedRule.id, selectedRule);
        toast.success('Rule updated successfully');
      } else {
        await configAPI.createRule(selectedRule);
        toast.success('Rule created successfully');
      }
      setShowRuleEditor(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save rule');
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      await configAPI.toggleRule(ruleId);
      toast.success('Rule status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await configAPI.deleteRule(ruleId);
      toast.success('Rule deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const handleDuplicateRule = async (ruleId) => {
    try {
      await configAPI.duplicateRule(ruleId);
      toast.success('Rule duplicated');
      fetchData();
    } catch (error) {
      toast.error('Failed to duplicate rule');
    }
  };

  const addCondition = () => {
    setSelectedRule({
      ...selectedRule,
      conditions: [...selectedRule.conditions, { field: '', operator: 'equals', value: '', logic: 'AND' }]
    });
  };

  const addAction = () => {
    setSelectedRule({
      ...selectedRule,
      actions: [...selectedRule.actions, { action_type: 'set_field', params: {} }]
    });
  };

  // ==================== VEHICLES ====================
  const handleSaveVehicle = async () => {
    if (!selectedVehicle.registration_number || !selectedVehicle.vehicle_type) {
      toast.error('Vehicle type and registration number are required');
      return;
    }
    
    try {
      if (selectedVehicle.id) {
        await configAPI.updateVehicle(selectedVehicle.id, selectedVehicle);
        toast.success('Vehicle updated');
      } else {
        await configAPI.createVehicle(selectedVehicle);
        toast.success('Vehicle added');
      }
      setShowVehicleDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vehicle');
    }
  };

  // ==================== SYSTEM SETTINGS ====================
  const handleSaveSettings = async () => {
    try {
      await configAPI.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings className="w-7 h-7 text-teal-600" />
            Configuration
          </h1>
          <p className="page-subtitle">Manage forms, workflow rules, vehicles, and system settings</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="forms" className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Forms
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1">
            <GitBranch className="w-4 h-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="triggers" className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Triggers
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-1">
            <Warehouse className="w-4 h-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-1">
            <Truck className="w-4 h-4" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="couriers" className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Couriers
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1">
            <Sliders className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* FORMS TAB */}
        <TabsContent value="forms" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Configurations</CardTitle>
              <CardDescription>Edit forms used throughout the system. System fields cannot be deleted.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {forms.map((form) => (
                  <div key={form.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div>
                      <p className="font-medium capitalize">{form.form_name.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-slate-500">{form.form_schema?.length || 0} fields • Version {form.version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={form.is_active ? 'default' : 'secondary'}>
                        {form.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => handleEditForm(form)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RULES TAB */}
        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Workflow Rules</CardTitle>
                <CardDescription>IF-THEN automation rules for different modules</CardDescription>
              </div>
              <Button onClick={handleCreateRule}>
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <GitBranch className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No workflow rules configured</p>
                  <Button variant="link" onClick={handleCreateRule}>Create your first rule</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.rule_name}</TableCell>
                        <TableCell className="capitalize">{rule.module}</TableCell>
                        <TableCell>{TRIGGER_EVENTS.find(t => t.value === rule.trigger_event)?.label}</TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditRule(rule)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDuplicateRule(rule.id)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleRule(rule.id)}>
                              {rule.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteRule(rule.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRIGGERS TAB */}
        <TabsContent value="triggers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Triggers</CardTitle>
              <CardDescription>Triggers that execute on database table events</CardDescription>
            </CardHeader>
            <CardContent>
              {triggers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Zap className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No triggers configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger Name</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {triggers.map((trigger) => (
                      <TableRow key={trigger.id}>
                        <TableCell className="font-medium">{trigger.trigger_name}</TableCell>
                        <TableCell>{trigger.table_name}</TableCell>
                        <TableCell className="capitalize">{trigger.trigger_type?.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={trigger.is_active ? 'default' : 'secondary'}>
                            {trigger.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => configAPI.toggleTrigger(trigger.id).then(fetchData)}>
                            {trigger.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VEHICLES TAB */}
        <TabsContent value="vehicles" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vehicle Fleet</CardTitle>
                <CardDescription>Manage vehicles for blood transport</CardDescription>
              </div>
              <Button onClick={() => { setSelectedVehicle({ vehicle_type: '', vehicle_model: '', registration_number: '', capacity: 10 }); setShowVehicleDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Truck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No vehicles registered</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-mono text-sm">{vehicle.vehicle_id}</TableCell>
                        <TableCell className="capitalize">{vehicle.vehicle_type}</TableCell>
                        <TableCell>{vehicle.vehicle_model}</TableCell>
                        <TableCell>{vehicle.registration_number}</TableCell>
                        <TableCell>{vehicle.capacity} units</TableCell>
                        <TableCell>{vehicle.driver_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={vehicle.is_active ? 'default' : 'secondary'}>
                            {vehicle.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedVehicle(vehicle); setShowVehicleDialog(true); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => configAPI.toggleVehicle(vehicle.id).then(fetchData)}>
                              {vehicle.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COURIERS TAB */}
        <TabsContent value="couriers" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Courier Partners</CardTitle>
                <CardDescription>Third-party courier services for delivery</CardDescription>
              </div>
              <Button onClick={() => { setSelectedCourier({ company_name: '', contact_person: '', contact_phone: '' }); setShowCourierDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Courier
              </Button>
            </CardHeader>
            <CardContent>
              {couriers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No courier partners registered</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couriers.map((courier) => (
                      <TableRow key={courier.id}>
                        <TableCell className="font-medium">{courier.company_name}</TableCell>
                        <TableCell>{courier.contact_person}</TableCell>
                        <TableCell>{courier.contact_phone}</TableCell>
                        <TableCell>{courier.contact_email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={courier.is_active ? 'default' : 'secondary'}>
                            {courier.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedCourier(courier); setShowCourierDialog(true); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => configAPI.toggleCourier(courier.id).then(fetchData)}>
                              {courier.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="mt-6">
          <div className="grid gap-6">
            {/* Eligibility Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle>Eligibility Thresholds</CardTitle>
                <CardDescription>Configure donor eligibility criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Min Hemoglobin (Male)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={settings.min_hemoglobin_male || ''} 
                      onChange={(e) => setSettings({...settings, min_hemoglobin_male: parseFloat(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">g/dL</p>
                  </div>
                  <div>
                    <Label>Min Hemoglobin (Female)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={settings.min_hemoglobin_female || ''} 
                      onChange={(e) => setSettings({...settings, min_hemoglobin_female: parseFloat(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">g/dL</p>
                  </div>
                  <div>
                    <Label>Min Weight</Label>
                    <Input 
                      type="number" 
                      value={settings.min_weight_kg || ''} 
                      onChange={(e) => setSettings({...settings, min_weight_kg: parseFloat(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">kg</p>
                  </div>
                  <div>
                    <Label>Age Range</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.min_age || ''} 
                        onChange={(e) => setSettings({...settings, min_age: parseInt(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.max_age || ''} 
                        onChange={(e) => setSettings({...settings, max_age: parseInt(e.target.value)})}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">years</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <Label>BP Systolic Range</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.min_bp_systolic || ''} 
                        onChange={(e) => setSettings({...settings, min_bp_systolic: parseInt(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.max_bp_systolic || ''} 
                        onChange={(e) => setSettings({...settings, max_bp_systolic: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>BP Diastolic Range</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.min_bp_diastolic || ''} 
                        onChange={(e) => setSettings({...settings, min_bp_diastolic: parseInt(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.max_bp_diastolic || ''} 
                        onChange={(e) => setSettings({...settings, max_bp_diastolic: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Min Donation Interval</Label>
                    <Input 
                      type="number" 
                      value={settings.min_donation_interval_days || ''} 
                      onChange={(e) => setSettings({...settings, min_donation_interval_days: parseInt(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Temperatures */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Temperatures</CardTitle>
                <CardDescription>Temperature ranges for blood component storage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Whole Blood (°C)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.whole_blood_temp_min || ''} 
                        onChange={(e) => setSettings({...settings, whole_blood_temp_min: parseFloat(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.whole_blood_temp_max || ''} 
                        onChange={(e) => setSettings({...settings, whole_blood_temp_max: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Plasma (°C)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.plasma_temp_min || ''} 
                        onChange={(e) => setSettings({...settings, plasma_temp_min: parseFloat(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.plasma_temp_max || ''} 
                        onChange={(e) => setSettings({...settings, plasma_temp_max: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Platelets (°C)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min"
                        value={settings.platelet_temp_min || ''} 
                        onChange={(e) => setSettings({...settings, platelet_temp_min: parseFloat(e.target.value)})}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max"
                        value={settings.platelet_temp_max || ''} 
                        onChange={(e) => setSettings({...settings, platelet_temp_max: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alert Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Settings</CardTitle>
                <CardDescription>Configure alert thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Expiry Alert Days</Label>
                    <Input 
                      type="number" 
                      value={settings.expiry_alert_days || ''} 
                      onChange={(e) => setSettings({...settings, expiry_alert_days: parseInt(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">Alert when items expire within this many days</p>
                  </div>
                  <div>
                    <Label>Low Stock Threshold</Label>
                    <Input 
                      type="number" 
                      value={settings.low_stock_threshold || ''} 
                      onChange={(e) => setSettings({...settings, low_stock_threshold: parseInt(e.target.value)})}
                    />
                    <p className="text-xs text-slate-500 mt-1">Alert when stock falls below this number</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} className="bg-teal-600 hover:bg-teal-700">
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Editor Dialog */}
      <Dialog open={showFormEditor} onOpenChange={setShowFormEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">Edit {selectedForm?.form_name?.replace(/_/g, ' ')} Form</DialogTitle>
            <DialogDescription>Drag to reorder fields. System fields cannot be deleted.</DialogDescription>
          </DialogHeader>
          
          {selectedForm && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Badge>Version {selectedForm.version}</Badge>
                <Button size="sm" onClick={handleAddField}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Field
                </Button>
              </div>
              
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {selectedForm.form_schema?.sort((a, b) => a.order - b.order).map((field, index) => (
                    <div key={field.name} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveField(index, 'up')} disabled={index === 0}>
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveField(index, 'down')} disabled={index === selectedForm.form_schema.length - 1}>
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          <Badge variant="outline" className="text-xs">{field.field_type}</Badge>
                          {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          {field.is_system_field && <Badge className="bg-blue-100 text-blue-700 text-xs">System</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">{field.name}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingField({...field, _isEditing: true}); setShowFieldDialog(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!field.is_system_field && (
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteField(field.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormEditor(false)}>Cancel</Button>
            <Button onClick={handleSaveForm} className="bg-teal-600 hover:bg-teal-700">
              <Save className="w-4 h-4 mr-2" />
              Save Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Editor Dialog */}
      <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField?._isEditing ? 'Edit Field' : 'Add New Field'}</DialogTitle>
          </DialogHeader>
          
          {editingField && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Field Name</Label>
                  <Input 
                    value={editingField.name} 
                    onChange={(e) => setEditingField({...editingField, name: e.target.value.toLowerCase().replace(/\s/g, '_')})}
                    disabled={editingField._isEditing}
                    placeholder="field_name"
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input 
                    value={editingField.label} 
                    onChange={(e) => setEditingField({...editingField, label: e.target.value})}
                    placeholder="Field Label"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Field Type</Label>
                  <Select value={editingField.field_type} onValueChange={(v) => setEditingField({...editingField, field_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch 
                    checked={editingField.required} 
                    onCheckedChange={(c) => setEditingField({...editingField, required: c})}
                  />
                  <Label>Required</Label>
                </div>
              </div>
              
              {['dropdown', 'multi_select', 'radio'].includes(editingField.field_type) && (
                <div>
                  <Label>Options (comma separated)</Label>
                  <Input 
                    value={(editingField.options || []).join(', ')} 
                    onChange={(e) => setEditingField({...editingField, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}
              
              <div>
                <Label>Help Text</Label>
                <Input 
                  value={editingField.help_text || ''} 
                  onChange={(e) => setEditingField({...editingField, help_text: e.target.value})}
                  placeholder="Instructions for the user"
                />
              </div>
              
              <div>
                <Label>Placeholder</Label>
                <Input 
                  value={editingField.placeholder || ''} 
                  onChange={(e) => setEditingField({...editingField, placeholder: e.target.value})}
                  placeholder="Placeholder text"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveField}>Save Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Editor Dialog */}
      <Dialog open={showRuleEditor} onOpenChange={setShowRuleEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRule?.id ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
          </DialogHeader>
          
          {selectedRule && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input 
                    value={selectedRule.rule_name} 
                    onChange={(e) => setSelectedRule({...selectedRule, rule_name: e.target.value})}
                    placeholder="Auto-reject low hemoglobin"
                  />
                </div>
                <div>
                  <Label>Module</Label>
                  <Select value={selectedRule.module} onValueChange={(v) => setSelectedRule({...selectedRule, module: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger Event</Label>
                  <Select value={selectedRule.trigger_event} onValueChange={(v) => setSelectedRule({...selectedRule, trigger_event: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_EVENTS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Input 
                    type="number" 
                    value={selectedRule.priority} 
                    onChange={(e) => setSelectedRule({...selectedRule, priority: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Conditions (IF)</Label>
                  <Button size="sm" variant="outline" onClick={addCondition}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Condition
                  </Button>
                </div>
                <div className="space-y-2">
                  {selectedRule.conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                      {idx > 0 && (
                        <Select 
                          value={cond.logic} 
                          onValueChange={(v) => {
                            const conds = [...selectedRule.conditions];
                            conds[idx].logic = v;
                            setSelectedRule({...selectedRule, conditions: conds});
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Input 
                        placeholder="Field name"
                        value={cond.field}
                        onChange={(e) => {
                          const conds = [...selectedRule.conditions];
                          conds[idx].field = e.target.value;
                          setSelectedRule({...selectedRule, conditions: conds});
                        }}
                        className="flex-1"
                      />
                      <Select 
                        value={cond.operator}
                        onValueChange={(v) => {
                          const conds = [...selectedRule.conditions];
                          conds[idx].operator = v;
                          setSelectedRule({...selectedRule, conditions: conds});
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Value"
                        value={cond.value}
                        onChange={(e) => {
                          const conds = [...selectedRule.conditions];
                          conds[idx].value = e.target.value;
                          setSelectedRule({...selectedRule, conditions: conds});
                        }}
                        className="w-32"
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-600"
                        onClick={() => {
                          const conds = selectedRule.conditions.filter((_, i) => i !== idx);
                          setSelectedRule({...selectedRule, conditions: conds});
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {selectedRule.conditions.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-2">No conditions added</p>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Actions (THEN)</Label>
                  <Button size="sm" variant="outline" onClick={addAction}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Action
                  </Button>
                </div>
                <div className="space-y-2">
                  {selectedRule.actions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                      <Select 
                        value={action.action_type}
                        onValueChange={(v) => {
                          const actions = [...selectedRule.actions];
                          actions[idx].action_type = v;
                          setSelectedRule({...selectedRule, actions: actions});
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(at => (
                            <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Parameters (JSON)"
                        value={JSON.stringify(action.params || {})}
                        onChange={(e) => {
                          try {
                            const actions = [...selectedRule.actions];
                            actions[idx].params = JSON.parse(e.target.value);
                            setSelectedRule({...selectedRule, actions: actions});
                          } catch {}
                        }}
                        className="flex-1"
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-600"
                        onClick={() => {
                          const actions = selectedRule.actions.filter((_, i) => i !== idx);
                          setSelectedRule({...selectedRule, actions: actions});
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {selectedRule.actions.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-2">No actions added</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch 
                  checked={selectedRule.is_active} 
                  onCheckedChange={(c) => setSelectedRule({...selectedRule, is_active: c})}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleEditor(false)}>Cancel</Button>
            <Button onClick={handleSaveRule} className="bg-teal-600 hover:bg-teal-700">
              <Save className="w-4 h-4 mr-2" />
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Dialog */}
      <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVehicle?.id ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
          </DialogHeader>
          
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehicle Type</Label>
                  <Select value={selectedVehicle.vehicle_type} onValueChange={(v) => setSelectedVehicle({...selectedVehicle, vehicle_type: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambulance">Ambulance</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="bike">Bike</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vehicle Model</Label>
                  <Input 
                    value={selectedVehicle.vehicle_model || ''} 
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, vehicle_model: e.target.value})}
                    placeholder="Toyota Innova"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Registration Number</Label>
                  <Input 
                    value={selectedVehicle.registration_number || ''} 
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, registration_number: e.target.value.toUpperCase()})}
                    placeholder="MH12AB1234"
                  />
                </div>
                <div>
                  <Label>Capacity (units)</Label>
                  <Input 
                    type="number"
                    value={selectedVehicle.capacity || ''} 
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, capacity: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Driver Name</Label>
                  <Input 
                    value={selectedVehicle.driver_name || ''} 
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, driver_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Driver Phone</Label>
                  <Input 
                    value={selectedVehicle.driver_phone || ''} 
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, driver_phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Driver License</Label>
                <Input 
                  value={selectedVehicle.driver_license || ''} 
                  onChange={(e) => setSelectedVehicle({...selectedVehicle, driver_license: e.target.value})}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVehicleDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveVehicle}>Save Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Courier Dialog */}
      <Dialog open={showCourierDialog} onOpenChange={setShowCourierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCourier?.id ? 'Edit Courier' : 'Add New Courier Partner'}</DialogTitle>
          </DialogHeader>
          
          {selectedCourier && (
            <div className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input 
                  value={selectedCourier.company_name || ''} 
                  onChange={(e) => setSelectedCourier({...selectedCourier, company_name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contact Person</Label>
                  <Input 
                    value={selectedCourier.contact_person || ''} 
                    onChange={(e) => setSelectedCourier({...selectedCourier, contact_person: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input 
                    value={selectedCourier.contact_phone || ''} 
                    onChange={(e) => setSelectedCourier({...selectedCourier, contact_phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input 
                  type="email"
                  value={selectedCourier.contact_email || ''} 
                  onChange={(e) => setSelectedCourier({...selectedCourier, contact_email: e.target.value})}
                />
              </div>
              <div>
                <Label>Address</Label>
                <Textarea 
                  value={selectedCourier.address || ''} 
                  onChange={(e) => setSelectedCourier({...selectedCourier, address: e.target.value})}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourierDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (selectedCourier.id) {
                  await configAPI.updateCourier(selectedCourier.id, selectedCourier);
                } else {
                  await configAPI.createCourier(selectedCourier);
                }
                toast.success('Courier saved');
                setShowCourierDialog(false);
                fetchData();
              } catch (error) {
                toast.error('Failed to save courier');
              }
            }}>Save Courier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
