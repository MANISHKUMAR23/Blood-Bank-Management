import React, { useState } from 'react';
import { publicDonorAPI } from '../lib/api';
import { toast } from 'sonner';
import { User, Phone, MapPin, CreditCard, CheckCircle, Loader2, Heart, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const genders = ['Male', 'Female', 'Other'];
const identityTypes = ['Aadhar', 'Passport', 'Driving License', 'Voter ID', 'PAN Card'];

export default function DonorRegisterForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    weight: '',
    phone: '',
    email: '',
    address: '',
    identity_type: '',
    identity_number: '',
    consent_given: false,
  });

  // Health questionnaire - same as staff portal
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

  const validateStep = (stepNum) => {
    switch (stepNum) {
      case 1:
        return formData.identity_type && formData.identity_number;
      case 2:
        return formData.full_name && formData.date_of_birth && formData.gender;
      case 3:
        return formData.phone && formData.address;
      case 4:
        return formData.consent_given;
      default:
        return true;
    }
  };

  // Check for disqualifying conditions
  const hasDisqualifyingConditions = () => {
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
      toast.error('You must consent to register as a donor');
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        health_questionnaire: questionnaire,
      };
      
      const response = await publicDonorAPI.register(data);
      toast.success('Registration submitted successfully!');
      onSuccess(response.data.request_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-teal-600 text-white'
                  : step > s
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 4 && (
              <div className={`w-8 h-0.5 ${step > s ? 'bg-teal-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Identity Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <CreditCard className="w-4 h-4 text-teal-600" />
            Identity Information
          </div>
          
          <div className="space-y-2">
            <Label>Government ID Type *</Label>
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
            <Label htmlFor="identity_number">ID Number *</Label>
            <Input
              id="identity_number"
              value={formData.identity_number}
              onChange={(e) => handleChange('identity_number', e.target.value)}
              placeholder="Enter your ID number"
              required
              data-testid="input-identity-number"
            />
          </div>
        </div>
      )}

      {/* Step 2: Demographics */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <User className="w-4 h-4 text-teal-600" />
            Personal Information
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Enter your full name"
              required
              data-testid="input-full-name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                <SelectTrigger data-testid="select-gender">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              placeholder="e.g., 65"
              data-testid="input-weight"
            />
            <p className="text-xs text-slate-500">Minimum weight for donation: 45 kg</p>
          </div>
        </div>
      )}

      {/* Step 3: Contact Information */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <Phone className="w-4 h-4 text-teal-600" />
            Contact Information
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Enter phone"
                required
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Enter email"
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
              placeholder="Enter your full address"
              rows={2}
              required
              data-testid="input-address"
            />
          </div>
        </div>
      )}

      {/* Step 4: Health Questionnaire & Consent */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Heart className="w-4 h-4 text-teal-600" />
            Health Questionnaire
          </div>
          <p className="text-xs text-slate-500 -mt-4">Please answer honestly - this helps ensure safe donation</p>

          {/* Warning for disqualifying conditions */}
          {hasDisqualifyingConditions() && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Possible Deferral</p>
                <p className="text-xs text-amber-700">Some of your responses may affect your eligibility. Staff will review during screening.</p>
              </div>
            </div>
          )}

          {/* General Health */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 text-sm">General Health</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
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
              
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
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

              <div className="p-2 bg-slate-50 rounded-lg space-y-2">
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
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 text-sm">Medical History</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 text-sm">Recent Activities (Last Year)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 text-sm">Lifestyle</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Alcohol Consumption</Label>
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
                <Label className="text-sm">Smoking Status</Label>
                <Select 
                  value={questionnaire.smoking_status}
                  onValueChange={(v) => handleQuestionnaireChange('smoking_status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_smoker">Non-smoker</SelectItem>
                    <SelectItem value="former_smoker">Former smoker</SelectItem>
                    <SelectItem value="occasional">Occasional</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Female-specific questions (conditionally shown) */}
          {formData.gender === 'Female' && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 text-sm">Female-Specific Questions</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm">Are you currently pregnant?</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pregnant"
                        checked={questionnaire.is_pregnant === true}
                        onChange={() => handleQuestionnaireChange('is_pregnant', true)}
                        className="accent-teal-600"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pregnant"
                        checked={questionnaire.is_pregnant === false}
                        onChange={() => handleQuestionnaireChange('is_pregnant', false)}
                        className="accent-teal-600"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm">Are you currently breastfeeding?</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="breastfeeding"
                        checked={questionnaire.is_breastfeeding === true}
                        onChange={() => handleQuestionnaireChange('is_breastfeeding', true)}
                        className="accent-teal-600"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="breastfeeding"
                        checked={questionnaire.is_breastfeeding === false}
                        onChange={() => handleQuestionnaireChange('is_breastfeeding', false)}
                        className="accent-teal-600"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  I consent to register as a blood donor *
                </label>
                <p className="text-xs text-slate-500">
                  By checking this box, I confirm that the information provided is accurate 
                  and I consent to be contacted for blood donation purposes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          Previous
        </Button>
        
        {step < 4 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!validateStep(step)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Next
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={loading || !validateStep(4)}
            className="bg-teal-600 hover:bg-teal-700"
            data-testid="submit-registration-btn"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              'Submit Registration'
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
