import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicDonorAPI } from '../lib/api';
import { toast } from 'sonner';
import { Droplet, Heart, Users, Clock, CheckCircle, Shield, ArrowRight, User, LogIn } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import DonorRegisterForm from '../components/DonorRegisterForm';
import DonorLoginForm from '../components/DonorLoginForm';

export default function DonorLanding() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  const handleAuthSuccess = (donor) => {
    setShowAuthModal(false);
    navigate('/donor/dashboard');
  };

  const handleRegistrationSuccess = (requestId) => {
    setShowAuthModal(false);
    toast.success('Registration submitted successfully!');
    navigate(`/donor/status?request=${requestId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">BBMS</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="text-slate-600"
              >
                Staff Login
              </Button>
              <Button 
                onClick={() => setShowAuthModal(true)}
                className="bg-teal-600 hover:bg-teal-700"
                data-testid="donor-auth-btn"
              >
                <User className="w-4 h-4 mr-2" />
                Donor Login / Register
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium">
                  <Heart className="w-4 h-4" />
                  Save Lives Today
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                Your Blood Can <span className="text-teal-600">Save Lives</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-xl">
                Join our community of life-savers. Register as a donor today and be part of the solution. 
                One donation can save up to 3 lives.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                  className="bg-teal-600 hover:bg-teal-700 text-lg px-8"
                  data-testid="register-now-btn"
                >
                  Register as Donor
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                  className="text-lg px-8"
                  data-testid="login-btn"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Existing Donor Login
                </Button>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-rose-500/20 rounded-3xl transform rotate-3"></div>
              <img 
                src="https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=600&h=500&fit=crop"
                alt="Blood Donation"
                className="relative rounded-3xl shadow-2xl w-full h-[500px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-teal-600">10K+</p>
              <p className="text-slate-600 mt-1">Registered Donors</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-rose-600">5K+</p>
              <p className="text-slate-600 mt-1">Units Collected</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-amber-600">15K+</p>
              <p className="text-slate-600 mt-1">Lives Saved</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-600">100%</p>
              <p className="text-slate-600 mt-1">Safe & Screened</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">How to Become a Donor</h2>
            <p className="text-slate-600 mt-2">Simple steps to start your life-saving journey</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">1. Register Online</h3>
                <p className="text-sm text-slate-600">Fill out the registration form with your details</p>
              </CardContent>
            </Card>
            
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">2. Wait for Approval</h3>
                <p className="text-sm text-slate-600">Our staff will review and approve your registration</p>
              </CardContent>
            </Card>
            
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">3. Get Screened</h3>
                <p className="text-sm text-slate-600">Complete health screening at our center</p>
              </CardContent>
            </Card>
            
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 text-rose-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">4. Donate & Save Lives</h3>
                <p className="text-sm text-slate-600">Your donation can save up to 3 lives</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Eligibility Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Eligibility Requirements</h2>
              <div className="space-y-4">
                {[
                  'Age between 18-65 years',
                  'Weight at least 45 kg',
                  'Hemoglobin level ≥ 12.5 g/dL',
                  'No major illness or recent surgery',
                  'Not donated blood in last 56 days',
                  'No tattoos or piercings in last 6 months',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=500&h=400&fit=crop"
                alt="Blood donation process"
                className="rounded-2xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-teal-600 to-teal-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Make a Difference?</h2>
          <p className="text-teal-100 mb-8 text-lg">
            Join thousands of donors who are saving lives every day. Your contribution matters.
          </p>
          <Button 
            size="lg"
            onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
            className="bg-white text-teal-700 hover:bg-teal-50 text-lg px-8"
          >
            Register Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Droplet className="w-6 h-6 text-teal-500" />
            <span className="text-white font-bold">BBMS</span>
          </div>
          <p className="text-sm">BBMS - Blood Bank Management System</p>
          <p className="text-xs mt-2">© 2024 BBMS. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-teal-600" />
              {authMode === 'login' ? 'Donor Login' : 'Register as Donor'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'login' 
                ? 'Enter your details to access your donor profile'
                : 'Fill in your details to register as a blood donor'
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Toggle between login and register */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'login' 
                  ? 'border-teal-600 text-teal-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              data-testid="modal-login-tab"
            >
              Existing Donor
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'register' 
                  ? 'border-teal-600 text-teal-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              data-testid="modal-register-tab"
            >
              New Donor
            </button>
          </div>

          {authMode === 'login' ? (
            <DonorLoginForm onSuccess={handleAuthSuccess} />
          ) : (
            <DonorRegisterForm onSuccess={handleRegistrationSuccess} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
