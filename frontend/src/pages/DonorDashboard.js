import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicDonorAPI } from '../lib/api';
import { toast } from 'sonner';
import { Droplet, LogOut, User, History, QrCode, Heart, Calendar, Droplets } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export default function DonorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [donations, setDonations] = useState([]);

  useEffect(() => {
    // Check if donor is logged in
    const donorToken = localStorage.getItem('donor_token');
    if (!donorToken) {
      navigate('/donor');
      return;
    }
    
    fetchProfile();
  }, [navigate]);

  const fetchProfile = async () => {
    try {
      const response = await publicDonorAPI.getProfile();
      setProfile(response.data.donor);
      setDonations(response.data.donations || []);
    } catch (error) {
      console.error('Profile load error:', error);
      // Clear invalid token and redirect
      localStorage.removeItem('donor_token');
      localStorage.removeItem('donor_info');
      toast.error('Session expired. Please login again.');
      navigate('/donor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('donor_token');
    localStorage.removeItem('donor_info');
    navigate('/donor');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700',
    deferred_temporary: 'bg-amber-100 text-amber-700',
    deferred_permanent: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">BBMS</span>
            </div>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-slate-600"
              data-testid="donor-logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">Welcome, {profile.full_name}!</h1>
                <p className="text-teal-100">Thank you for being a life-saver</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{profile.total_donations || 0}</p>
                  <p className="text-sm text-teal-200">Total Donations</p>
                </div>
                <div className="w-px h-12 bg-teal-500"></div>
                <div className="text-center">
                  {profile.blood_group ? (
                    <>
                      <p className="text-3xl font-bold">{profile.blood_group}</p>
                      <p className="text-sm text-teal-200">Blood Group</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium">Not Confirmed</p>
                      <p className="text-sm text-teal-200">Blood Group</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-teal-600" />
                    Your Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">Donor ID</p>
                    <p className="font-mono font-bold text-lg text-teal-600">{profile.donor_id}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Gender</p>
                      <p className="font-medium">{profile.gender}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Date of Birth</p>
                      <p className="font-medium">{profile.date_of_birth}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                  
                  {profile.email && (
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="font-medium text-sm">{profile.address}</p>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <p className="text-sm text-slate-500">Status</p>
                    <Badge className={statusColors[profile.status] || 'bg-slate-100 text-slate-700'}>
                      {profile.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code */}
              {profile.qr_code && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <QrCode className="w-5 h-5 text-teal-600" />
                      Your QR Code
                    </CardTitle>
                    <CardDescription>Show this at the donation center</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <img 
                      src={`data:image/png;base64,${profile.qr_code}`}
                      alt="Donor QR Code"
                      className="w-48 h-48 border rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Donation History */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-teal-600" />
                    Donation History
                  </CardTitle>
                  <CardDescription>Your past blood donations</CardDescription>
                </CardHeader>
                <CardContent>
                  {donations.length === 0 ? (
                    <div className="text-center py-12">
                      <Droplets className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500 mb-2">No donation history yet</p>
                      <p className="text-sm text-slate-400">
                        Visit your nearest blood bank to make your first donation!
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Donation ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donations.map((donation) => (
                          <TableRow key={donation.id}>
                            <TableCell className="font-mono text-sm">{donation.donation_id}</TableCell>
                            <TableCell>{donation.collection_start_time?.split('T')[0]}</TableCell>
                            <TableCell className="capitalize">{donation.donation_type?.replace('_', ' ')}</TableCell>
                            <TableCell>{donation.volume_collected || '-'} mL</TableCell>
                            <TableCell>
                              <Badge variant={donation.status === 'completed' ? 'default' : 'secondary'}>
                                {donation.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <Card className="bg-teal-50 border-teal-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-8 h-8 text-teal-600" />
                      <div>
                        <h3 className="font-semibold text-teal-800">Next Eligible Date</h3>
                        <p className="text-sm text-teal-600 mt-1">
                          {profile.last_donation_date 
                            ? `After ${new Date(new Date(profile.last_donation_date).getTime() + 56 * 24 * 60 * 60 * 1000).toLocaleDateString()}`
                            : 'You can donate anytime!'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-rose-50 border-rose-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Heart className="w-8 h-8 text-rose-600" />
                      <div>
                        <h3 className="font-semibold text-rose-800">Lives Saved</h3>
                        <p className="text-sm text-rose-600 mt-1">
                          Your {profile.total_donations || 0} donations could have saved up to {(profile.total_donations || 0) * 3} lives!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
