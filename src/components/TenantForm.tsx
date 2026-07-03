import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tenantSaveSchema, TenantSavePayload } from '../lib/validations';
import { 
  Building2, 
  Globe, 
  Palette, 
  Image as ImageIcon, 
  KeyRound, 
  ShieldCheck, 
  Loader2, 
  Info,
  CreditCard
} from 'lucide-react';
import clsx from 'clsx';

export const TenantForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset
  } = useForm<TenantSavePayload>({
    resolver: zodResolver(tenantSaveSchema),
    mode: 'onChange',
    defaultValues: {
      tenantData: {
        name: '',
        subdomain: '',
        theme: {
          primaryColor: '#3b82f6',
          logoUrl: ''
        },
        plan: 'free'
      },
      superAdminPassword: ''
    }
  });

  const formErrors = errors as any;

  const onSubmit = async (data: TenantSavePayload) => {
    setIsSubmitting(true);
    setSubmitSuccess(false);
    
    try {
      // Simulate API call for the demonstration
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Valid data ready to be sent to /api/tenants/save:', data);
      
      setSubmitSuccess(true);
      reset(); // Reset form after successful submission
      
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (error) {
      console.error('Failed to submit', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass = "w-full rounded-lg border bg-white px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

  return (
    <div className="w-full max-w-2xl mx-auto bg-white/60 backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl overflow-hidden p-6 sm:p-8">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-600" />
          Create New Tenant
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Fill in the details below to provision a new isolated workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ─── GENERAL DETAILS ─── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase border-b pb-2">
            General Details
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tenant Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                Tenant Name
              </label>
              <input
                type="text"
                placeholder="e.g., Acme Corp"
                disabled={isSubmitting}
                className={clsx(
                  inputBaseClass,
                  formErrors.tenantData?.name ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                )}
                {...register('tenantData.name')}
              />
              {formErrors.tenantData?.name && (
                <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                  {formErrors.tenantData.name.message}
                </span>
              )}
            </div>

            {/* Subdomain */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                Subdomain
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="acme-corp"
                  disabled={isSubmitting}
                  className={clsx(
                    inputBaseClass,
                    "pr-24", // make room for suffix
                    formErrors.tenantData?.subdomain ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  )}
                  {...register('tenantData.subdomain')}
                />
                <span className="absolute right-3 text-sm font-medium text-gray-400 pointer-events-none">
                  .fahmni.com
                </span>
              </div>
              {formErrors.tenantData?.subdomain ? (
                <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                  {formErrors.tenantData.subdomain.message}
                </span>
              ) : (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Lowercase, no spaces (e.g. acme-123)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── THEME & PLAN ─── */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase border-b pb-2">
            Configuration
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Primary Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-500" />
                Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  disabled={isSubmitting}
                  className="h-10 w-14 p-1 cursor-pointer rounded-lg border border-gray-200 bg-white"
                  {...register('tenantData.theme.primaryColor')}
                />
                <input
                  type="text"
                  disabled={isSubmitting}
                  className={clsx(
                    inputBaseClass,
                    formErrors.tenantData?.theme?.primaryColor ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  )}
                  {...register('tenantData.theme.primaryColor')}
                />
              </div>
              {formErrors.tenantData?.theme?.primaryColor && (
                <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                  {formErrors.tenantData.theme.primaryColor.message}
                </span>
              )}
            </div>

            {/* Plan Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                Subscription Plan
              </label>
              <select
                disabled={isSubmitting}
                className={clsx(
                  inputBaseClass,
                  "cursor-pointer appearance-none",
                  formErrors.tenantData?.plan ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                )}
                {...register('tenantData.plan')}
              >
                <option value="free">Free Tier</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              {formErrors.tenantData?.plan && (
                <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                  {formErrors.tenantData.plan.message}
                </span>
              )}
            </div>
            
            {/* Logo URL (Full width) */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                Logo URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                disabled={isSubmitting}
                className={clsx(
                  inputBaseClass,
                  formErrors.tenantData?.theme?.logoUrl ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                )}
                {...register('tenantData.theme.logoUrl')}
              />
              {formErrors.tenantData?.theme?.logoUrl && (
                <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                  {formErrors.tenantData.theme.logoUrl.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── AUTHORIZATION ─── */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase border-b pb-2">
            Authorization
          </h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-500" />
              Super Admin Password
            </label>
            <input
              type="password"
              placeholder="Enter your admin password to authorize"
              disabled={isSubmitting}
              className={clsx(
                inputBaseClass,
                errors.superAdminPassword ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
              )}
              {...register('superAdminPassword')}
            />
            {errors.superAdminPassword && (
              <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                {errors.superAdminPassword.message}
              </span>
            )}
          </div>
        </div>

        {/* ─── SUBMIT ACTIONS ─── */}
        <div className="pt-4 border-t flex items-center justify-between">
          <div className="text-sm">
            {submitSuccess && (
              <span className="text-green-600 font-medium animate-in fade-in flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Tenant created successfully!
              </span>
            )}
          </div>
          
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={clsx(
              "px-6 py-2.5 rounded-lg font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2 min-w-[140px]",
              !isValid || isSubmitting 
                ? "bg-blue-300 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-95"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Tenant'
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
