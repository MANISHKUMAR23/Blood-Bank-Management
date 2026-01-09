import React, { useState, useEffect } from 'react';
import { backupAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  Database, Download, Upload, Trash2, RefreshCw, Eye, 
  HardDrive, Clock, User, FileArchive, Check, AlertTriangle,
  Loader2, FolderArchive, Files
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import SensitiveActionModal from '../components/SensitiveActionModal';

export default function BackupManagement() {
  const { user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [includeFiles, setIncludeFiles] = useState(true);
  
  // Preview dialog
  const [previewBackup, setPreviewBackup] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Restore dialog
  const [restoreBackup, setRestoreBackup] = useState(null);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [restoreFiles, setRestoreFiles] = useState(true);
  const [restoring, setRestoring] = useState(false);
  
  // Delete confirmation
  const [deleteBackup, setDeleteBackup] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Sensitive action modal
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await backupAPI.list();
      setBackups(res.data || []);
    } catch (error) {
      toast.error('Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await backupAPI.create(includeFiles);
      toast.success(res.data.message);
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async (backup) => {
    setPreviewBackup(backup);
    setLoadingPreview(true);
    try {
      const res = await backupAPI.preview(backup.id);
      setPreviewData(res.data);
    } catch (error) {
      toast.error('Failed to load backup preview');
      setPreviewBackup(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      toast.info('Preparing download...');
      const res = await backupAPI.download(backup.id);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${backup.id}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download backup');
    }
  };

  const openRestoreDialog = (backup) => {
    setRestoreBackup(backup);
    setSelectedCollections([]);
    setRestoreFiles(backup.includes_files);
  };

  const initiateRestore = () => {
    // Require re-authentication for restore
    setPendingAction({
      type: 'restore',
      backup: restoreBackup,
      collections: selectedCollections.length > 0 ? selectedCollections : null,
      restoreFiles: restoreFiles
    });
    setShowSensitiveModal(true);
  };

  const handleRestore = async () => {
    if (!pendingAction || pendingAction.type !== 'restore') return;
    
    setRestoring(true);
    try {
      const res = await backupAPI.restore(
        pendingAction.backup.id,
        pendingAction.collections,
        pendingAction.restoreFiles
      );
      toast.success(res.data.message);
      setRestoreBackup(null);
      setPendingAction(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBackup) return;
    
    setDeleting(true);
    try {
      await backupAPI.delete(deleteBackup.id);
      toast.success('Backup deleted');
      setDeleteBackup(null);
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete backup');
    } finally {
      setDeleting(false);
    }
  };

  const toggleCollection = (collName) => {
    setSelectedCollections(prev => 
      prev.includes(collName) 
        ? prev.filter(c => c !== collName)
        : [...prev, collName]
    );
  };

  const selectAllCollections = () => {
    if (previewData?.collections) {
      setSelectedCollections(previewData.collections.map(c => c.name));
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  // Get backup scope badge
  const getScopeBadge = (backup) => {
    const scope = backup.backup_scope || 'system';
    if (scope === 'system') {
      return <Badge className="bg-purple-100 text-purple-700">System</Badge>;
    } else if (scope === 'org') {
      return <Badge className="bg-blue-100 text-blue-700">Organization</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-700">Branch</Badge>;
    }
  };

  // Check if user has admin access
  const isAdmin = user?.role === 'admin';
  const userType = user?.user_type;
  const isSystemAdmin = userType === 'system_admin';
  const isSuperAdmin = userType === 'super_admin';
  const isTenantAdmin = userType === 'tenant_admin';

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <p className="font-medium">Access Denied</p>
                <p className="text-sm">Only Administrators can access the Backup Management module.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get scope description based on user type
  const getScopeDescription = () => {
    if (isSystemAdmin) {
      return "Full database backup including all organizations and system data";
    } else if (isSuperAdmin) {
      return "Backup includes data from your organization and all its branches";
    } else {
      return "Backup includes data from your branch only";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backup & Recovery</h1>
          <p className="text-slate-500">
            {isSystemAdmin 
              ? "Manage database backups and restore data" 
              : isSuperAdmin 
                ? "Manage backups for your organization and branches"
                : "Manage backups for your branch"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchBackups} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Create Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-teal-600" />
            Create New Backup
          </CardTitle>
          <CardDescription>
            Create a snapshot of your database and uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-files"
                  checked={includeFiles}
                  onCheckedChange={setIncludeFiles}
                />
                <Label htmlFor="include-files" className="text-sm">
                  Include uploaded files (photos, documents)
                </Label>
              </div>
            </div>
            <Button 
              onClick={handleCreateBackup} 
              disabled={creating}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4 mr-2" />
                  Create Backup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-600" />
            Available Backups
          </CardTitle>
          <CardDescription>
            {backups.length} backup{backups.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No backups found</p>
              <p className="text-sm">Create your first backup to protect your data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Backup ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Collections</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-mono text-sm">{backup.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(backup.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{backup.size_mb} MB</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={backup.type === 'full' ? 'default' : 'secondary'}>
                        {backup.type === 'full' ? 'Full' : 'DB Only'}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.collections?.length || 0}</TableCell>
                    <TableCell>
                      {backup.includes_files ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <User className="w-3 h-3 text-slate-400" />
                        {backup.created_by}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(backup)}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(backup)}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRestoreDialog(backup)}
                          title="Restore"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteBackup(backup)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700"
                        >
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

      {/* Preview Dialog */}
      <Dialog open={!!previewBackup} onOpenChange={() => setPreviewBackup(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-blue-600" />
              Backup Preview
            </DialogTitle>
            <DialogDescription>
              {previewBackup?.id}
            </DialogDescription>
          </DialogHeader>
          
          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : previewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Created:</span>
                  <span className="ml-2 font-medium">{formatDate(previewData.created_at)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Size:</span>
                  <span className="ml-2 font-medium">{previewData.total_size_mb} MB</span>
                </div>
                <div>
                  <span className="text-slate-500">Created By:</span>
                  <span className="ml-2 font-medium">{previewData.created_by}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Collections ({previewData.collections?.length || 0})
                </h4>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {previewData.collections?.map((coll) => (
                    <div key={coll.name} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-mono">{coll.name}</span>
                      <Badge variant="outline">{coll.size_kb} KB</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {previewData.files && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Files className="w-4 h-4" />
                    Uploaded Files
                  </h4>
                  <div className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{previewData.files.file_count} files</span>
                      <Badge variant="outline">{previewData.files.size_mb} MB</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewBackup(null)}>Close</Button>
            <Button onClick={() => { setPreviewBackup(null); openRestoreDialog(previewBackup); }}>
              <Upload className="w-4 h-4 mr-2" />
              Restore This Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={!!restoreBackup} onOpenChange={() => setRestoreBackup(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Restore Backup
            </DialogTitle>
            <DialogDescription>
              Select what to restore from {restoreBackup?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Warning: This will overwrite existing data</p>
                  <p>Selected collections will be replaced with backup data. This action cannot be undone.</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Collections to Restore</h4>
                <Button variant="link" size="sm" onClick={selectAllCollections}>
                  Select All
                </Button>
              </div>
              <p className="text-sm text-slate-500 mb-2">
                Leave empty to restore all collections (full restore)
              </p>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {restoreBackup?.collections?.map((coll) => (
                  <label 
                    key={coll} 
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCollections.includes(coll)}
                      onCheckedChange={() => toggleCollection(coll)}
                    />
                    <span className="font-mono text-sm">{coll}</span>
                  </label>
                ))}
              </div>
              {selectedCollections.length > 0 && (
                <p className="text-sm text-teal-600 mt-2">
                  {selectedCollections.length} collection{selectedCollections.length !== 1 ? 's' : ''} selected (selective restore)
                </p>
              )}
            </div>

            {restoreBackup?.includes_files && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="restore-files"
                  checked={restoreFiles}
                  onCheckedChange={setRestoreFiles}
                />
                <Label htmlFor="restore-files" className="cursor-pointer">
                  Also restore uploaded files (photos, documents)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreBackup(null)}>Cancel</Button>
            <Button 
              onClick={initiateRestore}
              disabled={restoring}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {restoring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {selectedCollections.length > 0 ? 'Restore Selected' : 'Full Restore'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBackup} onOpenChange={() => setDeleteBackup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete backup <strong>{deleteBackup?.id}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sensitive Action Modal for Restore */}
      <SensitiveActionModal
        isOpen={showSensitiveModal}
        onClose={() => { setShowSensitiveModal(false); setPendingAction(null); }}
        onVerified={handleRestore}
        actionType="restore_backup"
        actionDescription={`Restore database from backup ${pendingAction?.backup?.id}`}
      />
    </div>
  );
}
