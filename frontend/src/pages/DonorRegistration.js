import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { donorAPI } from '../lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Save, User, Phone, MapPin, CreditCard, Upload, Heart, FileText, Camera, X, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['Male', 'Female', 'Other'];
const identityTypes = ['Aadhar', 'Passport', 'Driving License', 'Voter ID', 'PAN Card'];

export default function DonorRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const photoInputRef = useRef(null);
  const idProofInputRef = useRef(null);
  const medicalReportInputRef = useRef(null);

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    phone: '',
    email: '',
    address: '',
    identity_type: '',
    identity_number: '',
    weight: '',
    height: '',
    consent_given: false,
    registration_channel: 'on_site',
  });

  // File uploads
  const [photoPreview, setPhotoPreview] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState(null);
  const [medicalReports, setMedicalReports] = useState([]);

  // Health questionnaire
  const [questionnaire, setQuestionnaire] = useState({
    feeling_well_today: true,
    had_cold_flu_last_week: false,
    taking_medications: false,
    medication_details: '',
    had_surgery_last_year: false,
    surgery_details: '',
    has_chronic_illness: false,
    chronic_illness_details: '',
    has_heart_condition: false,
    has_diabetes: false,
    has_hypertension: false,
    has_bleeding_disorder: false,
    had_hepatitis: false,
    had_jaundice: false,
    had_malaria_last_year: false,
    had_typhoid_last_year: false,
    had_tuberculosis: false,
    hiv_risk_behavior: false,
    had_tattoo_last_year: false,
    had_piercing_last_year: false,
    received_blood_last_year: false,
    dental_procedure_last_month: false,
    alcohol_consumption: 'none',
    smoking_status: 'non_smoker',
    is_pregnant: null,
    is_breastfeeding: null,
    had_miscarriage_last_6_months: null,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionnaireChange = (field, value) => {
    setQuestionnaire(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return null;
    
    // Convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        if (type === 'photo') {
          setPhotoPreview(base64);
        } else if (type === 'id_proof') {
          setIdProofPreview(base64);
        }
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleMedicalReportUpload = (files) => {
    const newReports = Array.from(files).map(file => ({
      name: file.name,
      file: file,
      preview: URL.createObjectURL(file)
    }));
    setMedicalReports(prev => [...prev, ...newReports]);
  };

  const removeMedicalReport = (index) => {
    setMedicalReports(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = (stepNum) => {
    switch (stepNum) {
      case 1:
        return formData.full_name && formData.date_of_birth && formData.gender;
      case 2:
        return formData.phone && formData.address;
      case 3:
        return formData.identity_type && formData.identity_number;
      case 4:
        return true; // Health questionnaire is optional but recommended
      case 5:
        return formData.consent_given;
      default:
        return true;
    }
  };

  const hasHealthConcerns = () => {
    return (
      questionnaire.had_hepatitis ||
      questionnaire.had_tuberculosis ||
      questionnaire.hiv_risk_behavior ||
      questionnaire.has_bleeding_disorder ||
      !questionnaire.feeling_well_today
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.consent_given) {
      toast.error('Donor must provide consent to proceed');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        photo_url: photoPreview,
        id_proof_url: idProofPreview,
        health_questionnaire: questionnaire,
      };

      const response = await donorAPI.create(submitData);
      toast.success(`Donor registered successfully! ID: ${response.data.donor_id}`);
      navigate('/donors');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to register donor');
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 5;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="donor-registration">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/donors')} data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="page-title">Register New Donor</h1>
          <p className="page-subtitle">Step {step} of {totalSteps} - Complete donor registration</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors cursor-pointer ${
                step === s
                  ? 'bg-teal-600 text-white'
                  : step > s
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
              onClick={() => s < step && setStep(s)}
            >
              {s}
            </div>
            {s < totalSteps && (
              <div className={`w-12 h-1 rounded ${step > s ? 'bg-teal-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                Personal Information
              </CardTitle>
              <CardDescription>Basic details about the donor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="Enter full name"
                    required
                    data-testid="input-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                    required
                    data-testid="input-dob"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Blood Group (if known)</Label>
                  <Select value={formData.blood_group} onValueChange={(v) => handleChange('blood_group', v)}>
                    <SelectTrigger data-testid="select-blood-group">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    placeholder="e.g., 65"
                    min="30"
                    max="200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                    placeholder="e.g., 170"
                    min="100"
                    max="250"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'photo')}
                  />
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="Donor" className="w-24 h-24 rounded-lg object-cover border" />
                      <button
                        type="button"
                        onClick={() => setPhotoPreview(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Upload Photo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Contact Information */}
        {step === 2 && (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-teal-600" />
                Contact Information
              </CardTitle>
              <CardDescription>How to reach the donor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                    required
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="Enter email address"
                    data-testid="input-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter full address"
                  rows={3}
                  required
                  data-testid="input-address"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Identity & Documents */}
        {step === 3 && (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                Identity & Documents
              </CardTitle>
              <CardDescription>Verification documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Identity Type *</Label>
                  <Select value={formData.identity_type} onValueChange={(v) => handleChange('identity_type', v)}>
                    <SelectTrigger data-testid="select-identity-type">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      {identityTypes.map(it => (
                        <SelectItem key={it} value={it}>{it}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identity_number">Identity Number *</Label>
                  <Input
                    id="identity_number"
                    value={formData.identity_number}
                    onChange={(e) => handleChange('identity_number', e.target.value)}
                    placeholder="Enter ID number"
                    required
                    data-testid="input-identity-number"
                  />
                </div>
              </div>

              {/* ID Proof Upload */}
              <div className="space-y-2">
                <Label>ID Proof Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    ref={idProofInputRef}
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'id_proof')}
                  />
                  {idProofPreview ? (
                    <div className="relative">
                      <div className="w-32 h-24 rounded-lg border bg-slate-100 flex items-center justify-center overflow-hidden">
                        {idProofPreview.includes('data:image') ? (
                          <img src={idProofPreview} alt="ID Proof" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIdProofPreview(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => idProofInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload ID Proof
                    </Button>
                  )}
                </div>
              </div>

              {/* Medical Reports */}
              <div className="space-y-2">
                <Label>Medical Reports (Optional)</Label>
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={medicalReportInputRef}
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleMedicalReportUpload(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => medicalReportInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add Medical Report
                  </Button>
                  {medicalReports.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {medicalReports.map((report, index) => (
                        <div key={index} className="flex items-center gap-2 bg-slate-100 rounded px-3 py-1">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span className="text-sm truncate max-w-32">{report.name}</span>
                          <button
                            type="button"
                            onClick={() => removeMedicalReport(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Health Questionnaire */}
        {step === 4 && (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600" />
                Health Questionnaire
              </CardTitle>
              <CardDescription>Please answer honestly - this helps ensure safe donation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* General Health */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-700">General Health</h4>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">Are you feeling well today?</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="feeling_well"
                          checked={questionnaire.feeling_well_today === true}
                          onChange={() => handleQuestionnaireChange('feeling_well_today', true)}
                          className="accent-teal-600"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="feeling_well"
                          checked={questionnaire.feeling_well_today === false}
                          onChange={() => handleQuestionnaireChange('feeling_well_today', false)}
                          className="accent-teal-600"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">Had cold/flu in the last week?</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="cold_flu"
                          checked={questionnaire.had_cold_flu_last_week === true}
                          onChange={() => handleQuestionnaireChange('had_cold_flu_last_week', true)}
                          className="accent-teal-600"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="cold_flu"
                          checked={questionnaire.had_cold_flu_last_week === false}
                          onChange={() => handleQuestionnaireChange('had_cold_flu_last_week', false)}
                          className="accent-teal-600"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Currently taking any medications?</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="medications"
                            checked={questionnaire.taking_medications === true}
                            onChange={() => handleQuestionnaireChange('taking_medications', true)}
                            className="accent-teal-600"
                          />
                          <span className="text-sm">Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="medications"
                            checked={questionnaire.taking_medications === false}
                            onChange={() => handleQuestionnaireChange('taking_medications', false)}
                            className="accent-teal-600"
                          />
                          <span className="text-sm">No</span>
                        </label>
                      </div>
                    </div>
                    {questionnaire.taking_medications && (
                      <Input
                        placeholder="Please specify medications..."
                        value={questionnaire.medication_details}
                        onChange={(e) => handleQuestionnaireChange('medication_details', e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-700">Medical History</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'has_heart_condition', label: 'Heart condition' },
                    { key: 'has_diabetes', label: 'Diabetes' },
                    { key: 'has_hypertension', label: 'High blood pressure' },
                    { key: 'has_bleeding_disorder', label: 'Bleeding disorder' },
                    { key: 'had_hepatitis', label: 'Hepatitis (ever)' },
                    { key: 'had_jaundice', label: 'Jaundice (ever)' },
                    { key: 'had_tuberculosis', label: 'Tuberculosis (ever)' },
                    { key: 'had_malaria_last_year', label: 'Malaria (last year)' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                      <Checkbox
                        id={item.key}
                        checked={questionnaire[item.key]}
                        onCheckedChange={(checked) => handleQuestionnaireChange(item.key, checked)}
                      />
                      <label htmlFor={item.key} className="text-sm cursor-pointer">{item.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activities */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-700">Recent Activities (Last Year)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'had_tattoo_last_year', label: 'Got a tattoo' },
                    { key: 'had_piercing_last_year', label: 'Got a piercing' },
                    { key: 'received_blood_last_year', label: 'Received blood transfusion' },
                    { key: 'dental_procedure_last_month', label: 'Dental procedure (last month)' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                      <Checkbox
                        id={item.key}
                        checked={questionnaire[item.key]}
                        onCheckedChange={(checked) => handleQuestionnaireChange(item.key, checked)}
                      />
                      <label htmlFor={item.key} className="text-sm cursor-pointer">{item.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lifestyle */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-700">Lifestyle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Alcohol Consumption</Label>
                    <Select 
                      value={questionnaire.alcohol_consumption}
                      onValueChange={(v) => handleQuestionnaireChange('alcohol_consumption', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="occasional">Occasional</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Smoking Status</Label>
                    <Select 
                      value={questionnaire.smoking_status}
                      onValueChange={(v) => handleQuestionnaireChange('smoking_status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non_smoker">Non-smoker</SelectItem>
                        <SelectItem value="former">Former smoker</SelectItem>
                        <SelectItem value="current">Current smoker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Women Only - Show only if gender is Female */}
              {formData.gender === 'Female' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-700">Women Only</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { key: 'is_pregnant', label: 'Currently pregnant' },
                      { key: 'is_breastfeeding', label: 'Currently breastfeeding' },
                      { key: 'had_miscarriage_last_6_months', label: 'Miscarriage in last 6 months' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                        <Checkbox
                          id={item.key}
                          checked={questionnaire[item.key] === true}
                          onCheckedChange={(checked) => handleQuestionnaireChange(item.key, checked)}
                        />
                        <label htmlFor={item.key} className="text-sm cursor-pointer">{item.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning if health concerns */}
              {hasHealthConcerns() && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Health Concerns Detected</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Based on your responses, there may be eligibility concerns. A staff member will review your registration.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Consent */}
        {step === 5 && (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Consent & Confirmation
              </CardTitle>
              <CardDescription>Review and provide consent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <h4 className="font-medium">Registration Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500">Name:</span>
                  <span>{formData.full_name}</span>
                  <span className="text-slate-500">Gender:</span>
                  <span>{formData.gender}</span>
                  <span className="text-slate-500">Date of Birth:</span>
                  <span>{formData.date_of_birth}</span>
                  <span className="text-slate-500">Phone:</span>
                  <span>{formData.phone}</span>
                  <span className="text-slate-500">Identity:</span>
                  <span>{formData.identity_type} - {formData.identity_number}</span>
                  {formData.blood_group && (
                    <>
                      <span className="text-slate-500">Blood Group:</span>
                      <span className="blood-group-badge w-fit">{formData.blood_group}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Consent */}
              <div className="pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={formData.consent_given}
                    onCheckedChange={(checked) => handleChange('consent_given', checked)}
                    data-testid="checkbox-consent"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="consent"
                      className="text-sm font-medium cursor-pointer"
                    >
                      I consent to donate blood *
                    </label>
                    <p className="text-sm text-slate-500">
                      By checking this box, I confirm that:
                    </p>
                    <ul className="text-sm text-slate-500 list-disc list-inside space-y-1 mt-2">
                      <li>All information provided is true and accurate</li>
                      <li>I understand the blood donation process and its risks</li>
                      <li>I consent to have my blood collected and used for medical purposes</li>
                      <li>I authorize the blood bank to contact me for donation-related matters</li>
                      <li>I understand my blood will be tested for infectious diseases</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            data-testid="prev-step-btn"
          >
            Previous
          </Button>
          
          {step < totalSteps ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!validateStep(step)}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="next-step-btn"
            >
              Next Step
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || !validateStep(totalSteps)}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="submit-btn"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Register Donor
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
