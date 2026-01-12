import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticsEnhancedAPI } from '../lib/api';
import { toast } from 'sonner';
import {
  Package, MapPin, Clock, Phone, Truck, CheckCircle, Circle,
  AlertTriangle, Search, ArrowLeft, Droplet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const STATUS_CONFIG = {
  preparing: { color: 'bg-slate-100 text-slate-700', icon: Package, label: 'Preparing' },
  picked_up: { color: 'bg-blue-100 text-blue-700', icon: Package, label: 'Picked Up' },
  in_transit: { color: 'bg-amber-100 text-amber-700', icon: Truck, label: 'In Transit' },
  out_for_delivery: { color: 'bg-purple-100 text-purple-700', icon: Truck, label: 'Out for Delivery' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Delivered' },
  delayed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Delayed' },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Failed' },
};

export default function PublicTracking() {
  const { trackingNumber: urlTrackingNumber } = useParams();
  const navigate = useNavigate();
  
  const [trackingNumber, setTrackingNumber] = useState(urlTrackingNumber || '');
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (urlTrackingNumber) {
      fetchTracking(urlTrackingNumber);
    }
  }, [urlTrackingNumber]);

  const fetchTracking = async (number) => {
    if (!number) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await logisticsEnhancedAPI.publicTrack(number);
      setShipment(response.data);
    } catch (err) {
      setError('Shipment not found. Please check the tracking number.');
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (trackingNumber) {
      navigate(`/track/${trackingNumber}`);
      fetchTracking(trackingNumber);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusIndex = (status) => {
    const statuses = ['preparing', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    return statuses.indexOf(status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">BBMS</h1>
              <p className="text-xs text-slate-500">BBMS - Blood Bank Management System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              Track Your Shipment
            </CardTitle>
            <CardDescription>
              Enter your tracking number to see real-time shipment status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <Input
                placeholder="Enter tracking number (e.g., TRKXXXXXXXX)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                className="flex-1 text-lg"
              />
              <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Searching...' : 'Track'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                <p className="text-slate-500">Fetching shipment details...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipment Details */}
        {shipment && !loading && (
          <div className="space-y-6">
            {/* Status Overview */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Tracking Number</p>
                    <p className="text-2xl font-bold font-mono text-teal-600">{shipment.tracking_number}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={`${STATUS_CONFIG[shipment.status]?.color || 'bg-slate-100'} text-lg px-4 py-2`}>
                      {STATUS_CONFIG[shipment.status]?.label || shipment.status}
                    </Badge>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-8">
                  <div className="flex items-center justify-between relative">
                    {/* Progress line */}
                    <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200">
                      <div 
                        className="h-full bg-teal-500 transition-all duration-500"
                        style={{ 
                          width: shipment.status === 'delivered' ? '100%' : 
                                 shipment.status === 'failed' || shipment.status === 'delayed' ? `${(getStatusIndex('in_transit') / 4) * 100}%` :
                                 `${(getStatusIndex(shipment.status) / 4) * 100}%` 
                        }}
                      />
                    </div>
                    
                    {/* Steps */}
                    {['Preparing', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'].map((step, idx) => {
                      const currentIdx = getStatusIndex(shipment.status);
                      const isCompleted = currentIdx >= idx || shipment.status === 'delivered';
                      const isCurrent = currentIdx === idx;
                      
                      return (
                        <div key={step} className="relative z-10 flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-teal-500 text-white' : 
                            isCurrent ? 'bg-teal-100 text-teal-600 border-2 border-teal-500' : 
                            'bg-slate-200 text-slate-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          </div>
                          <p className={`mt-2 text-xs font-medium ${isCompleted ? 'text-teal-600' : 'text-slate-400'}`}>
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipment Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shipment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Destination</p>
                      <p className="font-medium">{shipment.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-teal-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Current Location</p>
                      <p className="font-medium">{shipment.current_location || 'Processing'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Truck className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Transport Method</p>
                      <p className="font-medium capitalize">{shipment.transport_method?.replace(/_/g, ' ') || 'Standard'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Dispatched</p>
                      <p className="font-medium">{formatDateTime(shipment.dispatch_time) || 'Pending'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Estimated Arrival</p>
                      <p className="font-medium">{formatDateTime(shipment.estimated_arrival) || 'Calculating...'}</p>
                    </div>
                  </div>
                  {shipment.actual_arrival && (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Delivered At</p>
                        <p className="font-medium">{formatDateTime(shipment.actual_arrival)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tracking Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tracking History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                  
                  {/* Timeline items */}
                  <div className="space-y-6">
                    {(shipment.tracking_timeline || []).slice().reverse().map((update, idx) => {
                      const StatusIcon = STATUS_CONFIG[update.status]?.icon || Circle;
                      const isLatest = idx === 0;
                      
                      return (
                        <div key={idx} className="relative flex gap-4">
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                            isLatest ? 'bg-teal-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'
                          }`}>
                            <StatusIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${isLatest ? 'text-teal-600' : 'text-slate-700'}`}>
                                {STATUS_CONFIG[update.status]?.label || update.status}
                              </p>
                              {isLatest && <Badge className="bg-teal-100 text-teal-700 text-xs">Latest</Badge>}
                            </div>
                            <p className="text-sm text-slate-500">{update.location}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatDateTime(update.timestamp)}</p>
                            {update.notes && (
                              <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded">{update.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            {shipment.contact_phone && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-teal-500" />
                      <div>
                        <p className="text-sm text-slate-500">Need Help?</p>
                        <p className="font-medium">{shipment.contact_phone}</p>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <a href={`tel:${shipment.contact_phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Now
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!shipment && !loading && !error && !urlTrackingNumber && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Enter Your Tracking Number</h3>
                <p className="text-slate-500">
                  Enter the tracking number provided by the blood bank to track your shipment in real-time.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} BBMS - Blood Bank Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
