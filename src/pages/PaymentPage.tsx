// PaymentPage.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createSubscriptionPayment } from '@/services/subscriptionService';
import { toast } from 'react-hot-toast';
import { 
  CreditCard, Smartphone, Building, Wallet, CheckCircle, 
  ArrowLeft, Lock, Shield, Globe, Phone, User,
  Loader2, Calendar
} from 'lucide-react';
import type { ReactElement } from 'react';

interface PlanData {
  id: string;
  name: string;
  price: number;
  type: string;
  max_users: string | number;
  max_products: string | number;
  billing_cycle: 'monthly' | 'yearly';
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: ReactElement;
  description: string;
  instructions: string[];
  supportedCountries?: string[];
}

interface PaymentDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  phoneNumber: string;
  operator: string;
  email: string;
  fullName: string;
}

interface Operator {
  id: string;
  name: string;
}

const OPERATORS: Operator[] = [
  { id: 'mpesa', name: 'M-Pesa' },
  { id: 'orange_money', name: 'Orange Money' },
  { id: 'airtel_money', name: 'Airtel Money' },
  { id: 'afrimoney', name: 'AfriMoney' },
];

const CARD_NUMBER_PATTERN = '[0-9\\s]{13,19}';
const CVV_PATTERN = '[0-9]{3}';
const REFERENCE_PREFIX = 'MEDIGEST';

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    phoneNumber: '',
    operator: 'mpesa',
    email: '',
    fullName: '',
  });

  const planData = location.state?.plan as PlanData | undefined;
  const currentPlan = location.state?.currentPlan as PlanData | undefined;

  useEffect(() => {
    if (!planData) {
      toast.error('Aucun plan sélectionné');
      navigate('/subscription');
    }
  }, [planData, navigate]);

  const paymentMethods = useMemo<PaymentMethod[]>(() => [
    {
      id: 'visa_mastercard',
      name: 'Carte Bancaire',
      icon: <CreditCard size={24} />,
      description: 'Paiement sécurisé par carte Visa/Mastercard',
      instructions: [
        'Entrez les détails de votre carte',
        'Le paiement est sécurisé et chiffré',
        'Reçu immédiat par email'
      ],
      supportedCountries: ['Tous les pays']
    },
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: <Smartphone size={24} />,
      description: 'Paiement mobile via M-Pesa',
      instructions: [
        'Entrez votre numéro M-Pesa',
        'Vous recevrez un code USSD',
        'Confirmez le paiement sur votre mobile'
      ],
      supportedCountries: ['Kenya', 'Tanzanie', 'RDC']
    },
    {
      id: 'orange_money',
      name: 'Orange Money',
      icon: <Phone size={24} />,
      description: 'Paiement mobile via Orange Money',
      instructions: [
        'Entrez votre numéro Orange Money',
        'Confirmez le paiement sur l\'application',
        'Transaction instantanée'
      ],
      supportedCountries: ['RDC', 'Côte d\'Ivoire', 'Sénégal']
    },
    {
      id: 'airtel_money',
      name: 'Airtel Money',
      icon: <Wallet size={24} />,
      description: 'Paiement mobile via Airtel Money',
      instructions: [
        'Entrez votre numéro Airtel Money',
        'Suivez les instructions USSD',
        'Validation en quelques secondes'
      ],
      supportedCountries: ['RDC', 'Rwanda', 'Tanzanie']
    },
    {
      id: 'afrimoney',
      name: 'AfriMoney',
      icon: <Globe size={24} />,
      description: 'Solution de paiement panafricaine',
      instructions: [
        'Entrez votre numéro AfriMoney',
        'Choisissez votre pays',
        'Paiement multi-devises disponible'
      ],
      supportedCountries: ['RDC', 'Congo', 'Cameroun', 'Gabon']
    },
    {
      id: 'bank_transfer',
      name: 'Virement Bancaire',
      icon: <Building size={24} />,
      description: 'Virement bancaire classique',
      instructions: [
        'Utilisez les coordonnées bancaires',
        'Indiquez la référence de paiement',
        'Envoi du reçu après confirmation'
      ],
      supportedCountries: ['Tous les pays']
    }
  ], []);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
  }, []);

  const generatePaymentReference = useCallback(() => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 11).toUpperCase();
    return `${REFERENCE_PREFIX}-${timestamp}-${randomString}`;
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentDetails(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMethod || !planData) {
      toast.error('Veuillez sélectionner un mode de paiement');
      return;
    }

    setIsLoading(true);

    try {
      const paymentData = {
        plan: planData.type,
        billing_period: planData.billing_cycle,
        payment_method: selectedMethod,
        amount: planData.price,
        reference: generatePaymentReference(),
      };

      const response = await createSubscriptionPayment(paymentData);
      
      toast.success('Paiement effectué avec succès !');
      
      navigate('/payment-success', {
        state: {
          payment: response,
          plan: planData,
          previousPlan: currentPlan
        }
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Erreur lors du paiement. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMethod, planData, currentPlan, navigate, generatePaymentReference]);

  const renderPaymentForm = () => {
    if (!selectedMethod) {
      return (
        <div className="text-center py-12">
          <CreditCard className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-medium">
            Sélectionnez un mode de paiement pour continuer
          </p>
        </div>
      );
    }

    const forms: Record<string, ReactElement> = {
      visa_mastercard: (
        <CreditCardForm
          details={paymentDetails}
          onChange={handleInputChange}
        />
      ),
      mpesa: (
        <MobilePaymentForm
          details={paymentDetails}
          onChange={handleInputChange}
          operators={OPERATORS}
        />
      ),
      orange_money: (
        <MobilePaymentForm
          details={paymentDetails}
          onChange={handleInputChange}
          operators={OPERATORS}
        />
      ),
      airtel_money: (
        <MobilePaymentForm
          details={paymentDetails}
          onChange={handleInputChange}
          operators={OPERATORS}
        />
      ),
      afrimoney: (
        <MobilePaymentForm
          details={paymentDetails}
          onChange={handleInputChange}
          operators={OPERATORS}
        />
      ),
      bank_transfer: (
        <BankTransferForm
          details={paymentDetails}
          onChange={handleInputChange}
        />
      ),
    };

    return forms[selectedMethod] || null;
  };

  if (!planData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-medical" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen -bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Header onBack={() => navigate('/subscription')} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <PaymentMethodsSection
              methods={paymentMethods}
              selectedMethod={selectedMethod}
              onSelectMethod={setSelectedMethod}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              isMethodSelected={!!selectedMethod}
              price={planData.price}
              formatPrice={formatPrice}
            >
              {renderPaymentForm()}
            </PaymentMethodsSection>

            <SecurityGuarantees />
          </div>

          <OrderSummary
            plan={planData}
            currentPlan={currentPlan}
            formatPrice={formatPrice}
          />
        </div>
      </div>
    </div>
  );
}

// Composants enfants pour une meilleure séparation des responsabilités
function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold mb-6 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour aux plans
        </button>
        <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">
          Paiement <span className="text-medical">Sécurisé</span>
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-2">
          Finalisez votre abonnement en toute sécurité
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <SecurityBadge icon={Shield} text="Paiement 100% sécurisé" />
        <SecurityBadge icon={Lock} text="SSL 256-bit" />
      </div>
    </div>
  );
}

function SecurityBadge({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <Icon size={20} className="text-medical" />
      <span className="text-xs font-bold uppercase">{text}</span>
    </div>
  );
}

interface PaymentMethodsSectionProps {
  methods: PaymentMethod[];
  selectedMethod: string;
  onSelectMethod: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isMethodSelected: boolean;
  price: number;
  formatPrice: (price: number) => string;
  children: React.ReactNode;
}

function PaymentMethodsSection({
  methods,
  selectedMethod,
  onSelectMethod,
  onSubmit,
  isLoading,
  isMethodSelected,
  price,
  formatPrice,
  children
}: PaymentMethodsSectionProps) {
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
      <h2 className="text-2xl font-black text-slate-900 uppercase italic mb-2">
        Mode de paiement
      </h2>
      <p className="text-slate-500 text-sm mb-8">
        Choisissez votre méthode de paiement préférée
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {methods.map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            isSelected={selectedMethod === method.id}
            onSelect={onSelectMethod}
          />
        ))}
      </div>

      <form onSubmit={onSubmit}>
        {children}
        
        <div className="mt-8 pt-8 border-t border-slate-100">
          <TermsCheckbox />
          
          <SubmitButton
            isLoading={isLoading}
            isDisabled={!isMethodSelected || isLoading}
            price={price}
            formatPrice={formatPrice}
          />
          
          <SecurityNote />
        </div>
      </form>
    </div>
  );
}

function PaymentMethodCard({ 
  method, 
  isSelected, 
  onSelect 
}: { 
  method: PaymentMethod; 
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(method.id)}
      className={`p-6 rounded-3xl border-2 transition-all text-left group hover:scale-[1.02] ${
        isSelected
          ? 'border-medical bg-medical/5 shadow-lg shadow-medical/10'
          : 'border-slate-100 hover:border-medical/30 hover:bg-slate-50'
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
        isSelected
          ? 'bg-medical text-white'
          : 'bg-slate-100 text-slate-400 group-hover:text-medical'
      }`}>
        {method.icon}
      </div>
      <h3 className="font-black text-slate-900 mb-2">{method.name}</h3>
      <p className="text-xs text-slate-500 leading-tight">{method.description}</p>
      
      {isSelected && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-600 uppercase mb-2">Instructions:</p>
          <ul className="space-y-1">
            {method.instructions.map((instruction, idx) => (
              <li key={idx} className="text-xs text-slate-500 flex items-start gap-2">
                <CheckCircle size={12} className="text-medical shrink-0 mt-0.5" />
                {instruction}
              </li>
            ))}
          </ul>
          {method.supportedCountries && (
            <p className="text-xs text-slate-400 mt-3">
              Disponible en: {method.supportedCountries.join(', ')}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

function CreditCardForm({ 
  details, 
  onChange 
}: { 
  details: PaymentDetails; 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <FormField
        label="Numéro de carte"
        name="cardNumber"
        value={details.cardNumber}
        onChange={onChange}
        placeholder="1234 5678 9012 3456"
        maxLength={19}
        pattern={CARD_NUMBER_PATTERN}
      />
      
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Date d'expiration"
          name="expiryDate"
          value={details.expiryDate}
          onChange={onChange}
          placeholder="MM/AA"
          maxLength={5}
        />
        <FormField
          label="CVV"
          name="cvv"
          value={details.cvv}
          onChange={onChange}
          placeholder="123"
          maxLength={3}
          pattern={CVV_PATTERN}
        />
      </div>
      
      <FormField
        label="Nom sur la carte"
        name="fullName"
        value={details.fullName}
        onChange={onChange}
        placeholder="John Doe"
      />
    </div>
  );
}

function MobilePaymentForm({ 
  details, 
  onChange,
  operators
}: { 
  details: PaymentDetails; 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  operators: Operator[];
}) {
  return (
    <div className="space-y-4">
      <FormField
        label="Numéro de téléphone"
        name="phoneNumber"
        value={details.phoneNumber}
        onChange={onChange}
        placeholder="+243 81 234 5678"
        type="tel"
      />
      
      <FormSelect
        label="Opérateur"
        name="operator"
        value={details.operator}
        onChange={onChange}
        options={operators}
      />
      
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-amber-800">
          💡 Après soumission, vous recevrez un code USSD sur votre téléphone pour confirmer le paiement.
        </p>
      </div>
    </div>
  );
}

function BankTransferForm({ 
  details, 
  onChange 
}: { 
  details: PaymentDetails; 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
        <BankDetails />
        <PaymentReference />
      </div>
      
      <FormField
        label="Email pour le reçu"
        name="email"
        value={details.email}
        onChange={onChange}
        placeholder="votre@email.com"
        type="email"
      />
    </div>
  );
}

function BankDetails() {
  return (
    <div>
      <h4 className="font-black text-slate-900 uppercase text-sm mb-2">
        Coordonnées bancaires
      </h4>
      <div className="space-y-2 text-sm">
        <p><span className="font-bold">Banque:</span> Afriland First Bank</p>
        <p><span className="font-bold">IBAN:</span> CD31 0001 2345 6789 0123 4567 89</p>
        <p><span className="font-bold">SWIFT/BIC:</span> CCAFCDK1</p>
        <p><span className="font-bold">Bénéficiaire:</span> MEDIGEST SARL</p>
      </div>
    </div>
  );
}

function PaymentReference() {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="font-black text-slate-900 uppercase text-sm mb-2">
        Référence de paiement
      </h4>
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <code className="font-mono font-black text-lg text-medical">
          MEDIGEST-{Date.now().toString().slice(-8)}
        </code>
        <p className="text-xs text-slate-500 mt-2">
          Incluez cette référence dans l'objet du virement
        </p>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  pattern
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  pattern?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-medical focus:ring-2 focus:ring-medical/20 transition-all"
        maxLength={maxLength}
        pattern={pattern}
      />
    </div>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Operator[];
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-medical focus:ring-2 focus:ring-medical/20 transition-all appearance-none"
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TermsCheckbox() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <input
        type="checkbox"
        id="terms"
        required
        className="w-5 h-5 rounded border-slate-300 text-medical focus:ring-medical"
      />
      <label htmlFor="terms" className="text-sm text-slate-600">
        J'accepte les{' '}
        <a href="/terms" className="text-medical font-bold hover:underline">
          conditions générales
        </a>{' '}
        et la{' '}
        <a href="/privacy" className="text-medical font-bold hover:underline">
          politique de confidentialité
        </a>
      </label>
    </div>
  );
}

function SubmitButton({
  isLoading,
  isDisabled,
  price,
  formatPrice
}: {
  isLoading: boolean;
  isDisabled: boolean;
  price: number;
  formatPrice: (price: number) => string;
}) {
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
        isDisabled
          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
          : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-xl'
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin" size={20} />
          Traitement du paiement...
        </div>
      ) : (
        `Payer ${formatPrice(price)}`
      )}
    </button>
  );
}

function SecurityNote() {
  return (
    <p className="text-center text-xs text-slate-400 mt-4">
      <Lock size={12} className="inline mr-1" />
      Vos données sont sécurisées et cryptées
    </p>
  );
}

function SecurityGuarantees() {
  const guarantees = [
    {
      icon: Shield,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-100',
      title: 'Garantie 30 jours',
      description: 'Remboursement intégral si non satisfait'
    },
    {
      icon: Lock,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-100',
      title: 'Paiement sécurisé',
      description: 'Cryptage SSL 256-bit certifié'
    },
    {
      icon: User,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-100',
      title: 'Support 24/7',
      description: 'Assistance technique disponible'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {guarantees.map((guarantee, index) => (
        <div key={index} className="bg-white rounded-3xl border border-slate-100 p-6 text-center">
          <div className={`w-12 h-12 ${guarantee.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <guarantee.icon className={guarantee.iconColor} size={24} />
          </div>
          <h4 className="font-black text-slate-900 mb-2">{guarantee.title}</h4>
          <p className="text-xs text-slate-500">{guarantee.description}</p>
        </div>
      ))}
    </div>
  );
}

function OrderSummary({ 
  plan, 
  currentPlan, 
  formatPrice 
}: { 
  plan: PlanData; 
  currentPlan?: PlanData; 
  formatPrice: (price: number) => string;
}) {
  const vatAmount = plan.price * 0.18;
  const totalAmount = plan.price + vatAmount;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-4xl text-white p-8 sticky top-8 shadow-2xl">
        <h3 className="font-black text-2xl uppercase italic mb-8">
          Récapitulatif
        </h3>

        <div className="space-y-6">
          {currentPlan && (
            <CurrentPlanSection plan={currentPlan} formatPrice={formatPrice} />
          )}
          
          <NewPlanSection plan={plan} formatPrice={formatPrice} />
          
          <PriceBreakdown
            price={plan.price}
            vatAmount={vatAmount}
            totalAmount={totalAmount}
            formatPrice={formatPrice}
            billingCycle={plan.billing_cycle}
          />
        </div>
      </div>

      <PaymentMethodLogos />
    </div>
  );
}

function CurrentPlanSection({ plan, formatPrice }: { plan: PlanData; formatPrice: (price: number) => string }) {
  return (
    <div className="pb-6 border-b border-slate-700">
      <p className="text-xs font-bold text-slate-400 uppercase mb-2">
        Plan actuel
      </p>
      <div className="flex justify-between items-center">
        <span className="font-medium">{plan.name}</span>
        <span className="text-sm text-slate-300">
          {plan.price === 0 ? 'Gratuit' : `${formatPrice(plan.price)}/mois`}
        </span>
      </div>
    </div>
  );
}

function NewPlanSection({ plan, formatPrice }: { plan: PlanData; formatPrice: (price: number) => string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase mb-2">
        Nouveau plan
      </p>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="font-black text-lg">{plan.name}</span>
          <span className="font-black text-2xl text-medical">
            {plan.price === 0 ? 'Gratuit' : `${formatPrice(plan.price)}`}
          </span>
        </div>
        <div className="text-sm space-y-2">
          <PlanDetail label="Utilisateurs:" value={plan.max_users === "Illimité" ? "Illimité" : plan.max_users} />
          <PlanDetail label="Produits:" value={plan.max_products === "Illimité" ? "Illimité" : plan.max_products} />
          <PlanDetail 
            label="Période:" 
            value={plan.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'} 
          />
        </div>
      </div>
    </div>
  );
}

function PlanDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <p className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function PriceBreakdown({ 
  price, 
  vatAmount, 
  totalAmount, 
  formatPrice,
  billingCycle 
}: { 
  price: number; 
  vatAmount: number; 
  totalAmount: number; 
  formatPrice: (price: number) => string;
  billingCycle: string;
}) {
  return (
    <>
      <div className="pt-6 border-t border-slate-700 space-y-4">
        <PriceLine label="Sous-total" value={formatPrice(price)} />
        <PriceLine label="TVA (18%)" value={formatPrice(vatAmount)} />
        <div className="flex justify-between items-center text-lg pt-4 border-t border-slate-700">
          <span className="font-black">Total</span>
          <span className="font-black text-2xl text-medical">
            {formatPrice(totalAmount)}
          </span>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-700">
        <div className="flex items-start gap-3 text-sm text-slate-400">
          <Calendar size={16} className="shrink-0 mt-0.5" />
          <p>
            Facturation {billingCycle === 'yearly' ? 'annuelle' : 'mensuelle'}. 
            Renouvellement automatique. Annulation à tout moment.
          </p>
        </div>
      </div>
    </>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function PaymentMethodLogos() {
  const logos = [
    { label: 'VISA', color: 'text-blue-600' },
    { label: 'Mastercard', color: 'text-red-600' },
    { label: 'M-Pesa', color: 'text-orange-600' },
    { label: 'Orange', color: 'text-green-600' }
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6">
      <p className="text-xs font-bold text-slate-600 uppercase mb-4 text-center">
        Moyens de paiement acceptés
      </p>
      <div className="grid grid-cols-4 gap-4">
        {logos.map((logo, index) => (
          <div key={index} className="bg-slate-50 rounded-2xl p-3 flex items-center justify-center">
            <span className={`font-black ${logo.color} text-sm`}>{logo.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}