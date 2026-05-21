import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Settings,
  Phone,
  ExternalLink,
  Copy,
  Clock,
  Coins,
  TrendingUp,
  CheckCircle,
  Search,
  X,
  Edit2,
  Trash2,
  Filter,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Link,
  DollarSign,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Users,
  UserCheck,
  BarChart2,
  LogOut,
  Lock,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, ClientStatus, AppConfig, DatabaseState, SignupLink, ReferralAgent } from './types.js';

// Status styling mapping for badges
const statusDetails: Record<
  ClientStatus,
  { label: string; bg: string; text: string; border: string; description: string }
> = {
  'Cadastrando': {
    label: 'Cadastrando',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    description: 'Cliente preenchendo dados ou em fase de onboarding inicial.'
  },
  'Dados Pendentes': {
    label: 'Dados Pendentes',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    description: 'Aguardando envio ou validação de documentação.'
  },
  'Em Processamento de Recompensa': {
    label: 'Em Processamento de Recompensa',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    description: 'A recompensa foi aprovada e cairá amanhã (Cashback + Indicação).'
  },
  'Cashback Recebido': {
    label: 'Cashback Recebido',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    description: 'Apenas a comissão de Cashback deste cliente foi confirmada.'
  },
  'Indicação Recebida': {
    label: 'Indicação Recebida',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    description: 'Apenas a comissão do Link de Indicação usado foi confirmada.'
  },
  'Recebido Total': {
    label: 'Recebido Total',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    description: 'Tanto o Cashback quanto o Link de Indicação foram totalmente pagos.'
  },
  'Não Validou': {
    label: 'Não Validou',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    description: 'O cadastro do cliente não foi aprovado pelo regulamento.'
  }
};

export default function App() {
  // App states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('admin_token');
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const apiFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
    const token = localStorage.getItem('admin_token');
    const headers = {
      ...(options.headers || {}),
      'Authorization': token ? `Bearer ${token}` : '',
    } as Record<string, string>;

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      setIsAuthenticated(false);
    }

    return response;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Credenciais inválidas.');
      }
      const data = await response.json();
      localStorage.setItem('admin_token', data.token);
      setIsAuthenticated(true);
      showToast('Login realizado com sucesso!');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    showToast('Sessão encerrada.');
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    defaultCashback: 50,
    defaultInviteValue: 30,
    defaultReferralCommission: 40,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New states for SignupLink and ReferralAgent entities
  const [signupLinks, setSignupLinks] = useState<SignupLink[]>([]);
  const [referralAgents, setReferralAgents] = useState<ReferralAgent[]>([]);
  
  // View Switcher: 'clients' | 'links' | 'referrers' | 'reports'
  const [currentView, setCurrentView] = useState<'clients' | 'links' | 'referrers' | 'reports'>('clients');

  // Modals for Links CRUD
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SignupLink | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkValue, setLinkValue] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNotes, setLinkNotes] = useState('');

  // Modals for Referrals/ReferrerAgents CRUD
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ReferralAgent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentCommission, setAgentCommission] = useState('');
  const [agentNotes, setAgentNotes] = useState('');

  // Customizable report states
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportGroupBy, setReportGroupBy] = useState<'none' | 'status' | 'link' | 'referrer'>('none');
  const [reportedColumns, setReportedColumns] = useState({
    name: true,
    whatsapp: true,
    status: true,
    cashback: true,
    linkValue: true,
    totalBonus: true,
    createdAt: true
  });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'forecast' | 'received' | 'notValidated'>('all');

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [newClientReferredBy, setNewClientReferredBy] = useState('');
  const [newClientSignupLinkOwner, setNewClientSignupLinkOwner] = useState('');
  const [newClientSignupLinkValue, setNewClientSignupLinkValue] = useState<string>('');
  const [newClientInviteLink, setNewClientInviteLink] = useState('');
  const [newClientOwnInviteValue, setNewClientOwnInviteValue] = useState<string>('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Editing Client Form State (temporary values)
  const [editClientName, setEditClientName] = useState('');
  const [editClientWhatsapp, setEditClientWhatsapp] = useState('');
  const [editClientReferredBy, setEditClientReferredBy] = useState('');
  const [editClientSignupLinkOwner, setEditClientSignupLinkOwner] = useState('');
  const [editClientSignupLinkValue, setEditClientSignupLinkValue] = useState<number>(0);
  const [editClientInviteLink, setEditClientInviteLink] = useState('');
  const [editClientOwnInviteValue, setEditClientOwnInviteValue] = useState<number>(0);
  const [editClientNotes, setEditClientNotes] = useState('');
  const [editClientStatus, setEditClientStatus] = useState<ClientStatus>('Cadastrando');
  const [editClientCashback, setEditClientCashback] = useState<number>(0);

  // Config Form State
  const [cfgCashback, setCfgCashback] = useState<string>('');
  const [cfgInviteValue, setCfgInviteValue] = useState<string>('');
  const [cfgReferralCommission, setCfgReferralCommission] = useState<string>('');

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto hide notifications
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch state on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchState();
    }
  }, [isAuthenticated]);

  const fetchState = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/api/state');
      if (!response.ok) throw new Error('Falha ao comunicar com o servidor.');
      const data: DatabaseState = await response.json();
      setClients(data.clients);
      setConfig(data.config);
      setSignupLinks(data.signupLinks || []);
      setReferralAgents(data.referralAgents || []);

      // Initialize config form
      setCfgCashback(data.config.defaultCashback.toString());
      setCfgInviteValue(data.config.defaultInviteValue.toString());
      setCfgReferralCommission(data.config.defaultReferralCommission.toString());
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Setup default form values when opening forms or when config changes
  useEffect(() => {
    if (config) {
      if (!newClientSignupLinkValue) setNewClientSignupLinkValue(config.defaultInviteValue.toString());
      if (!newClientOwnInviteValue) setNewClientOwnInviteValue(config.defaultInviteValue.toString());
    }
  }, [config]);

  // Load and save configurations
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultCashback: Number(cfgCashback),
          defaultInviteValue: Number(cfgInviteValue),
          defaultReferralCommission: Number(cfgReferralCommission),
        }),
      });

      if (!res.ok) throw new Error('Não foi possível salvar as configurações.');
      const updatedConfig = await res.json();
      setConfig(updatedConfig);
      setIsConfigModalOpen(false);
      showToast('Configurações globais salvas com sucesso!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Export report to UTF-8 BOM CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    if (reportedColumns.name) headers.push('Cliente');
    if (reportedColumns.whatsapp) headers.push('WhatsApp');
    if (reportedColumns.status) headers.push('Status');
    if (reportedColumns.cashback) headers.push('Cashback (R$)');
    if (reportedColumns.linkValue) headers.push('Valor do Link (R$)');
    if (reportedColumns.totalBonus && (reportedColumns.cashback || reportedColumns.linkValue)) headers.push('Total Acumulado (R$)');
    if (reportedColumns.createdAt) headers.push('Data Cadastro');

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    csvContent += headers.join(';') + '\r\n';

    reportFilteredClients.forEach(c => {
      let row: string[] = [];
      if (reportedColumns.name) row.push(c.name.replace(/;/g, ' '));
      if (reportedColumns.whatsapp) row.push(c.whatsapp);
      if (reportedColumns.status) row.push(c.status);
      if (reportedColumns.cashback) row.push(c.cashbackAmount.toString());
      if (reportedColumns.linkValue) row.push(c.signupLinkValue.toString());
      if (reportedColumns.totalBonus && (reportedColumns.cashback || reportedColumns.linkValue)) {
        let sum = 0;
        if (c.status === 'Recebido Total' || c.status === 'Em Processamento de Recompensa') {
          sum = c.cashbackAmount + c.signupLinkValue;
        } else if (c.status === 'Cashback Recebido') {
          sum = c.cashbackAmount;
        } else if (c.status === 'Indicação Recebida') {
          sum = c.signupLinkValue;
        }
        row.push(sum.toString());
      }
      if (reportedColumns.createdAt) row.push(new Date(c.createdAt).toLocaleDateString('pt-BR'));
      csvContent += row.join(';') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Recompensas_Personalizado_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha CSV gerada e baixada com sucesso!');
  };

  // Handle client creation
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientWhatsapp) {
      showToast('Nome e WhatsApp são obrigatórios.', 'error');
      return;
    }

    try {
      const payload = {
        name: newClientName,
        whatsapp: newClientWhatsapp,
        referredBy: newClientReferredBy,
        signupLinkOwner: newClientSignupLinkOwner,
        signupLinkValue: newClientSignupLinkValue ? Number(newClientSignupLinkValue) : config.defaultInviteValue,
        inviteLink: newClientInviteLink,
        ownInviteValue: newClientOwnInviteValue ? Number(newClientOwnInviteValue) : config.defaultInviteValue,
        notes: newClientNotes,
      };

      const res = await apiFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erro ao salvar o novo cliente.');
      const clientCreated = await res.json();

      setClients((prev) => [...prev, clientCreated]);
      setIsAddModalOpen(false);
      showToast(`${newClientName} cadastrado com sucesso!`);

      // Reset Form fields
      setNewClientName('');
      setNewClientWhatsapp('');
      setNewClientReferredBy('');
      setNewClientSignupLinkOwner('');
      setNewClientSignupLinkValue(config.defaultInviteValue.toString());
      setNewClientInviteLink('');
      setNewClientOwnInviteValue(config.defaultInviteValue.toString());
      setNewClientNotes('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- CARDS & ENTITIES TRIGGERS FOR SIGNUP LINKS AND REFERRAL AGENTS ---

  // Opens modal for creating a new Signup Link
  const openCreateLinkModal = () => {
    setEditingLink(null);
    setLinkName('');
    setLinkValue(config.defaultInviteValue.toString());
    setLinkUrl('');
    setLinkNotes('');
    setIsLinkModalOpen(true);
  };

  // Opens modal for editing an existing Signup Link
  const startEditLink = (link: SignupLink) => {
    setEditingLink(link);
    setLinkName(link.name);
    setLinkValue(link.value.toString());
    setLinkUrl(link.url || '');
    setLinkNotes(link.notes || '');
    setIsLinkModalOpen(true);
  };

  // Submits either a clean new link or saves updates
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName) {
      showToast('Nome é obrigatório.', 'error');
      return;
    }
    try {
      const urlPath = editingLink ? `/api/signup-links/${editingLink.id}` : '/api/signup-links';
      const methodType = editingLink ? 'PUT' : 'POST';
      const payload = {
        name: linkName,
        value: Number(linkValue) || 0,
        url: linkUrl,
        notes: linkNotes
      };

      const res = await apiFetch(urlPath, {
        method: methodType,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha ao gravar link de indicação.');
      showToast(editingLink ? 'Link atualizado com sucesso!' : 'Link criado com sucesso!');
      setIsLinkModalOpen(false);
      await fetchState();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Triggers deletion of specified Signup Link
  const handleDeleteLink = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente deletar o link de indicação "${name}"? isso não alterará clientes que já o utilizaram.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/signup-links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar o link.');
      showToast('Link de indicação excluído com sucesso.');
      await fetchState();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Opens modal for creating a new ReferralAgent
  const openCreateAgentModal = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentCommission(config.defaultReferralCommission.toString());
    setAgentNotes('');
    setIsAgentModalOpen(true);
  };

  // Opens modal for editing an existing ReferralAgent
  const startEditAgent = (agent: ReferralAgent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentCommission(agent.commissionValue.toString());
    setAgentNotes(agent.notes || '');
    setIsAgentModalOpen(true);
  };

  // Submits or update ReferralAgent data
  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName) {
      showToast('Nome do indicador é obrigatório.', 'error');
      return;
    }
    try {
      const urlPath = editingAgent ? `/api/referral-agents/${editingAgent.id}` : '/api/referral-agents';
      const methodType = editingAgent ? 'PUT' : 'POST';
      const payload = {
        name: agentName,
        commissionValue: Number(agentCommission) || 0,
        notes: agentNotes
      };

      const res = await apiFetch(urlPath, {
        method: methodType,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha ao gravar indicador.');
      showToast(editingAgent ? 'Indicador atualizado com sucesso!' : 'Indicador criado com sucesso!');
      setIsAgentModalOpen(false);
      await fetchState();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Triggers deletion of specified ReferralAgent
  const handleDeleteAgent = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente deletar o indicador "${name}"? isto não alterará clientes que já o referenciaram.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/referral-agents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar o indicador.');
      showToast('Indicador excluído com sucesso.');
      await fetchState();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Setup editing fields
  const startEditClient = (client: Client) => {
    setSelectedClient(client);
    setEditClientName(client.name);
    setEditClientWhatsapp(client.whatsapp);
    setEditClientReferredBy(client.referredBy || '');
    setEditClientSignupLinkOwner(client.signupLinkOwner || '');
    setEditClientSignupLinkValue(client.signupLinkValue);
    setEditClientInviteLink(client.inviteLink || '');
    setEditClientOwnInviteValue(client.ownInviteValue);
    setEditClientNotes(client.notes || '');
    setEditClientStatus(client.status);
    setEditClientCashback(client.cashbackAmount);
    setIsEditModalOpen(true);
  };

  // Save client edits
  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const payload = {
        name: editClientName,
        whatsapp: editClientWhatsapp,
        referredBy: editClientReferredBy,
        signupLinkOwner: editClientSignupLinkOwner,
        signupLinkValue: editClientSignupLinkValue,
        inviteLink: editClientInviteLink,
        ownInviteValue: editClientOwnInviteValue,
        notes: editClientNotes,
        status: editClientStatus,
        cashbackAmount: editClientCashback,
      };

      const res = await apiFetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erro ao salvar modificações do cliente.');
      const updated = await res.json();

      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsEditModalOpen(false);
      setSelectedClient(null);
      showToast(`Cadastro de ${editClientName} atualizado com sucesso.`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle client status updates directly from table quick drop
  const handleQuickStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    try {
      const res = await apiFetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Erro de comunicação.');
      const updated = await res.json();

      setClients((prev) => prev.map((c) => (c.id === clientId ? updated : c)));
      showToast(`Status de ${updated.name} alterado para "${statusDetails[newStatus].label}"`);
    } catch (err: any) {
      showToast('Ocorreu um erro ao atualizar o status.', 'error');
    }
  };

  // Handle deletion of client
  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Tem certeza absoluta de que deseja excluir o cliente "${clientName}"? Todos os valores relacionados a comissões e cashback serão perdidos.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Erro de comunicação.');
      await res.json();

      setClients((prev) => prev.filter((c) => c.id !== clientId));
      showToast(`Cliente ${clientName} foi removido do controle.`);
    } catch (err: any) {
      showToast('Não foi possível excluir o cadastro.', 'error');
    }
  };

  // Seed standard example to showcase exactly the Cauê & Márcia scenario requested
  const handleSeedExample = async () => {
    try {
      // Create Cauê first with customized links
      const res1 = await apiFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Cauê Silva',
          whatsapp: '11999998888',
          referredBy: '',
          signupLinkOwner: 'Divulgação Externa',
          signupLinkValue: config.defaultInviteValue,
          inviteLink: 'https://seusite.com/convite/caue',
          ownInviteValue: 45,
          notes: 'Doador ativo de indicações e parceiro do canal.',
        }),
      });
      if (!res1.ok) throw new Error();
      const caue = await res1.json();

      // Create Márcia
      const res2 = await apiFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Márcia Souza',
          whatsapp: '21988887777',
          referredBy: '',
          signupLinkOwner: 'Instagram Blog',
          signupLinkValue: config.defaultInviteValue,
          inviteLink: 'https://seusite.com/convite/marcia',
          ownInviteValue: 60, // Marcia possesses a highly valued invite link (defined value)
          notes: 'Digital Influencer com link de convite customizado de R$ 60.',
        }),
      });
      if (!res2.ok) throw new Error();
      const marcia = await res2.json();

      // Create Verônica referred by Cauê using Márcia's high-value link
      const res3 = await apiFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Verônica Santos',
          whatsapp: '31977770000',
          referredBy: 'Cauê Silva',
          signupLinkOwner: 'Márcia Souza',
          signupLinkValue: 60, // Uses Márcia's defined link value (she invited her)
          inviteLink: 'https://seusite.com/convite/veronica',
          ownInviteValue: config.defaultInviteValue,
          notes: 'Exemplo prático solicitado no regulamento. Indicado por Cauê usando link de Márcia.',
        }),
      });
      if (!res3.ok) throw new Error();
      const veronica = await res3.json();

      // Set Verônica status to processed to preview the next day's rewards
      await apiFetch(`/api/clients/${veronica.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Em Processamento de Recompensa' }),
      });

      await fetchState();
      showToast('Cenário de exemplo (Cauê, Márcia e Verônica) gerado com sucesso!');
    } catch (err) {
      showToast('Erro ao semear dados de teste.', 'error');
    }
  };

  // Helper formatting values with BRL Currency format
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Helper to format WhatsApp URL
  const formatWhatsappLink = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Olá ${clientName}! Estou acompanhando o seu progresso na indicação e recompensas de cashback em nosso sistema. Como estão as coisas por aí?`
    );
    return `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${text}`;
  };

  // Helper to format Date nicely
  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculated Metrics
  const metrics = useMemo(() => {
    let totalCorrectValue = 0; // Confirmed rewards
    let cashbackReceivedTotal = 0;
    let inviteReceivedTotal = 0;

    let forecastedValue = 0; // Promised rewards for tomorrow
    let forecastedCashback = 0;
    let forecastedInvite = 0;

    clients.forEach((c) => {
      // 1. O Valor Correto, deve ser modificado somente quando o status estiver como Recebido Total, 
      // se for Cashback Recebido somente computar o valor do cashback e se for Indicação Recebida, 
      // somente contar o valor do link usado pra cadastrar o cliente.
      if (c.status === 'Recebido Total') {
        const valueSum = c.cashbackAmount + c.signupLinkValue;
        totalCorrectValue += valueSum;
        cashbackReceivedTotal += c.cashbackAmount;
        inviteReceivedTotal += c.signupLinkValue;
      } else if (c.status === 'Cashback Recebido') {
        totalCorrectValue += c.cashbackAmount;
        cashbackReceivedTotal += c.cashbackAmount;
      } else if (c.status === 'Indicação Recebida') {
        totalCorrectValue += c.signupLinkValue;
        inviteReceivedTotal += c.signupLinkValue;
      }

      // 2. O Cashback e a Indicação caem no dia posterior ao cliente entrar no status de Em Processamento de Recompensa
      // Usar isso como base para exibir o valor de previsão que vou receber no outro dia.
      if (c.status === 'Em Processamento de Recompensa') {
        forecastedValue += (c.cashbackAmount + c.signupLinkValue);
        forecastedCashback += c.cashbackAmount;
        forecastedInvite += c.signupLinkValue;
      }
    });

    return {
      totalCorrectValue,
      cashbackReceivedTotal,
      inviteReceivedTotal,
      forecastedValue,
      forecastedCashback,
      forecastedInvite,
      totalClients: clients.length,
      statusesCount: clients.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {})
    };
  }, [clients]);

  // Clients filtering list
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Text Match (Name, WhatsApp, Referrer, Link Owner, or Notes)
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.whatsapp.includes(searchTerm) ||
        (c.referredBy && c.referredBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.signupLinkOwner && c.signupLinkOwner.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      // Tab Match
      let matchesTab = true;
      if (activeTab === 'forecast') {
        matchesTab = c.status === 'Em Processamento de Recompensa';
      } else if (activeTab === 'received') {
        matchesTab = ['Cashback Recebido', 'Indicação Recebida', 'Recebido Total'].includes(c.status);
      } else if (activeTab === 'notValidated') {
        matchesTab = c.status === 'Não Validou';
      }

      // Quick status dropdown match
      const matchesStatusDropdown = statusFilter === 'all' || c.status === statusFilter;

      return matchesSearch && matchesTab && matchesStatusDropdown;
    });
  }, [clients, searchTerm, statusFilter, activeTab]);

  // --- REPORT GENERATION AND COMPUTING MEMOIZED BLOCKS ---

  const reportFilteredClients = useMemo(() => {
    return clients.filter(c => {
      // Date filter
      if (reportStartDate) {
        const start = new Date(reportStartDate);
        const createdNow = new Date(c.createdAt);
        if (createdNow < start) return false;
      }
      if (reportEndDate) {
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);
        const createdNow = new Date(c.createdAt);
        if (createdNow > end) return false;
      }
      // Status filter
      if (reportStatusFilter !== 'all' && c.status !== reportStatusFilter) {
        return false;
      }
      return true;
    });
  }, [clients, reportStartDate, reportEndDate, reportStatusFilter]);

  const reportMetrics = useMemo(() => {
    let totalCashback = 0;
    let totalLinkValue = 0;
    let totalValue = 0;

    reportFilteredClients.forEach(c => {
      if (c.status === 'Recebido Total') {
        totalValue += (c.cashbackAmount + c.signupLinkValue);
        totalCashback += c.cashbackAmount;
        totalLinkValue += c.signupLinkValue;
      } else if (c.status === 'Cashback Recebido') {
        totalValue += c.cashbackAmount;
        totalCashback += c.cashbackAmount;
      } else if (c.status === 'Indicação Recebida') {
        totalValue += c.signupLinkValue;
        totalLinkValue += c.signupLinkValue;
      } else if (c.status === 'Em Processamento de Recompensa') {
        totalValue += (c.cashbackAmount + c.signupLinkValue);
        totalCashback += c.cashbackAmount;
        totalLinkValue += c.signupLinkValue;
      }
    });

    const count = reportFilteredClients.length;
    const avgCashback = count > 0 ? (totalCashback / count) : 0;

    return {
      totalCashback,
      totalLinkValue,
      totalValue,
      count,
      avgCashback
    };
  }, [reportFilteredClients]);

  const reportGroupedData = useMemo(() => {
    if (reportGroupBy === 'none') return [];

    const groups: Record<string, { key: string; count: number; cashback: number; linkValue: number; total: number; clients: Client[] }> = {};

    reportFilteredClients.forEach(c => {
      let gKey = 'Não Especificado';
      if (reportGroupBy === 'status') {
        gKey = statusDetails[c.status]?.label || c.status;
      } else if (reportGroupBy === 'link') {
        gKey = c.signupLinkOwner || 'Sem Link Criador';
      } else if (reportGroupBy === 'referrer') {
        gKey = c.referredBy || 'Sem Indicador Direto';
      }

      if (!groups[gKey]) {
        groups[gKey] = { key: gKey, count: 0, cashback: 0, linkValue: 0, total: 0, clients: [] };
      }

      groups[gKey].count += 1;
      groups[gKey].clients.push(c);

      let cbSum = 0;
      let lvSum = 0;
      if (c.status === 'Recebido Total') {
        cbSum = c.cashbackAmount;
        lvSum = c.signupLinkValue;
      } else if (c.status === 'Cashback Recebido') {
        cbSum = c.cashbackAmount;
      } else if (c.status === 'Indicação Recebida') {
        lvSum = c.signupLinkValue;
      } else if (c.status === 'Em Processamento de Recompensa') {
        cbSum = c.cashbackAmount;
        lvSum = c.signupLinkValue;
      }
      groups[gKey].cashback += cbSum;
      groups[gKey].linkValue += lvSum;
      groups[gKey].total += (cbSum + lvSum);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [reportFilteredClients, reportGroupBy]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-900 selection:text-white relative overflow-hidden font-sans">
        
        {/* Subtle decorative grid lines/blur */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 z-0"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl z-0"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl z-0"></div>

        {/* Feedback Toast bar */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-950 text-emerald-250 border-emerald-800'
                  : 'bg-rose-950 text-rose-205 border-rose-800'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span className="font-medium text-sm">{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-md z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-xl shadow-blue-950/20 mb-2 border border-blue-500/30">
              <span className="text-2xl font-black text-white">R</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Guardião de Recompensas</h2>
            <p className="text-slate-400 text-xs max-w-xs mx-auto">
              Controle administrativo integrado via PostgreSQL • Easypanel VPS
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-8 rounded-2xl shadow-2xl space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Painel de Acesso</h3>
              <p className="text-slate-400 text-xs">Insira os seus dados de administrador para entrar.</p>
            </div>

            {loginError && (
              <div className="p-3.5 bg-rose-950/45 border border-rose-800/70 text-rose-200 text-xs rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Usuário</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                    placeholder="Utilize as credenciais do VPS"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="Injete a senha administrativa"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-semibold rounded-xl text-white text-sm shadow-lg shadow-blue-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loginLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar no Sistema
                  </>
                )}
              </button>
            </form>
          </motion.div>

          <p className="text-center text-slate-600 text-[11px]">
            Segurança ativa de banco PostgreSQL • Sem formulários de registro
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      {/* Upper Feedback Toast bar */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-850 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium text-sm">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Bar / Navigation Header */}
      <header className="flex flex-col md:flex-row items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0 shadow-sm shadow-blue-100">R</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
              RewardsControl <span className="text-xs font-normal text-slate-400 italic">v2.4</span>
            </h1>
            <p className="text-xs text-slate-500">
              Controle de Recompensas e Cashback • EasyPanel Client
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 mt-4 md:mt-0">
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Previsão para Amanhã</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(metrics.forecastedValue || 0)}</p>
            </div>
            <div className="w-[1px] h-10 bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold font-sans">Cashback Configurado</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xl font-bold text-slate-800">{formatCurrency(config.defaultCashback)}</span>
                <button 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 transition"
                  title="Ajustar valores padrão"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="w-[1px] h-10 bg-slate-200 hidden sm:block"></div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            {clients.length === 0 && (
              <button
                type="button"
                onClick={handleSeedExample}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition cursor-pointer"
                title="Semeia os casos práticos para simulação de dados"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Simular Caso Prático
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition shadow-sm text-xs cursor-pointer"
              id="btn_add_client"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Cadastrar Cliente
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-rose-600 rounded bg-slate-150 hover:bg-rose-50 transition text-xs font-semibold cursor-pointer"
              title="Sair do sistema"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Problema ao buscar sincronização externa</p>
              <p className="text-xs text-rose-600">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Horizontal Navigation Tab Bar */}
        <div className="flex flex-wrap border-b border-slate-200">
          <button
            onClick={() => setCurrentView('clients')}
            className={`px-5 py-3 border-b-2 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === 'clients'
                ? 'border-blue-605 text-blue-600 font-bold bg-blue-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Carteira de Clientes
          </button>
          <button
            onClick={() => setCurrentView('links')}
            className={`px-5 py-3 border-b-2 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === 'links'
                ? 'border-blue-605 text-blue-600 font-bold bg-blue-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link className="w-4 h-4" />
            Links de Indicação ({signupLinks.length})
          </button>
          <button
            onClick={() => setCurrentView('referrers')}
            className={`px-5 py-3 border-b-2 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === 'referrers'
                ? 'border-blue-605 text-blue-600 font-bold bg-blue-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Indicadores Cadastrados ({referralAgents.length})
          </button>
          <button
            onClick={() => setCurrentView('reports')}
            className={`px-5 py-3 border-b-2 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === 'reports'
                ? 'border-blue-605 text-blue-600 font-bold bg-blue-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Relatório Personalizável
          </button>
        </div>

        {currentView === 'clients' && (
          <>
            {/* Global Key Rates Bar Display */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-white p-5 border border-slate-200 rounded-xl items-center shadow-xs">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 pb-2 lg:pb-0 border-b lg:border-b-0 lg:border-r border-slate-100 pr-4">
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Regras Ativas</span>
            <span className="text-xs text-slate-400 block mt-0.5">Parâmetros de comissão para novas adesões</span>
          </div>
          <div className="px-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Cashback Padrão</span>
            <span className="text-base font-bold text-blue-600 block">{formatCurrency(config.defaultCashback)}</span>
          </div>
          <div className="px-2 border-l border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Convite Padrão (Link)</span>
            <span className="text-base font-bold text-slate-700 block">{formatCurrency(config.defaultInviteValue)}</span>
          </div>
          <div className="px-2 border-l border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Comissão Indicação</span>
            <span className="text-base font-bold text-slate-700 block">{formatCurrency(config.defaultReferralCommission)}</span>
          </div>
        </div>

        {/* Financial Metrics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Metric 1: Forecast for Tomorrow */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded text-blue-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-550 uppercase tracking-widest">Previsão para Amanhã</span>
                </div>
                <div className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-tighter">
                  Fila de Liberação
                </div>
              </div>
              
              <div className="my-2">
                <div className="text-3xl font-extrabold text-blue-600 tracking-tight">
                  {formatCurrency(metrics.forecastedValue)}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Total acumulado em processamento para cair amanhã, somando o cashback individual aos links de indicação ativados.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Previsão Cashback</span>
                <span className="text-slate-800 font-bold">{formatCurrency(metrics.forecastedCashback)}</span>
              </div>
              <div className="border-l border-slate-100 pl-3">
                <span className="text-slate-400 block font-medium">Previsão do Link</span>
                <span className="text-slate-800 font-bold">{formatCurrency(metrics.forecastedInvite)}</span>
              </div>
            </div>
          </div>

          {/* Metric 2: Valor Correto Recebido (Confirmed Realized) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-50 rounded text-green-700">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-550 uppercase tracking-widest">Valor Correto Recebido</span>
                </div>
                <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 font-bold px-2 py-0.5 rounded uppercase tracking-tighter">
                  Efetivado
                </span>
              </div>

              <div className="my-2">
                <div className="text-3xl font-extrabold text-green-700 tracking-tight">
                  {formatCurrency(metrics.totalCorrectValue)}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Total já efetivado na carteira, comissões totalmente validadas. Regras de faturamento estrito são aplicadas.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Cashback Recebido</span>
                <span className="text-slate-800 font-bold">{formatCurrency(metrics.cashbackReceivedTotal)}</span>
              </div>
              <div className="border-l border-slate-100 pl-3">
                <span className="text-slate-400 block font-medium">Indicador via Link</span>
                <span className="text-slate-800 font-bold">{formatCurrency(metrics.inviteReceivedTotal)}</span>
              </div>
            </div>
          </div>

          {/* Metric 3: Client Distribution Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-100 rounded text-slate-700">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Divisão por Status</span>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                  Clientes: {metrics.totalClients}
                </span>
              </div>

              <div className="space-y-2 mt-4 text-xs font-medium">
                {/* Visual Ratio Progress Bar */}
                <div className="h-2 w-full bg-slate-100 rounded flex overflow-hidden">
                  <div
                    title={`Processando: ${metrics.statusesCount['Em Processamento de Recompensa'] || 0}`}
                    style={{ width: `${((metrics.statusesCount['Em Processamento de Recompensa'] || 0) / (metrics.totalClients || 1)) * 100}%` }}
                    className="bg-blue-500 h-full transition"
                  ></div>
                  <div
                    title={`Confirmados: ${(metrics.statusesCount['Recebido Total'] || 0) + (metrics.statusesCount['Cashback Recebido'] || 0) + (metrics.statusesCount['Indicação Recebida'] || 0)}`}
                    style={{
                      width: `${(((metrics.statusesCount['Recebido Total'] || 0) +
                        (metrics.statusesCount['Cashback Recebido'] || 0) +
                        (metrics.statusesCount['Indicação Recebida'] || 0)) /
                        (metrics.totalClients || 1)) *
                        100}%`
                    }}
                    className="bg-green-500 h-full transition"
                  ></div>
                  <div
                    title={`Dados Pendentes / Cadastrando: ${(metrics.statusesCount['Dados Pendentes'] || 0) + (metrics.statusesCount['Cadastrando'] || 0)}`}
                    style={{
                      width: `${(((metrics.statusesCount['Dados Pendentes'] || 0) + (metrics.statusesCount['Cadastrando'] || 0)) / (metrics.totalClients || 1)) *
                        100}%`
                    }}
                    className="bg-amber-500 h-full transition"
                  ></div>
                  <div
                    title={`Não Validou: ${metrics.statusesCount['Não Validou'] || 0}`}
                    style={{ width: `${((metrics.statusesCount['Não Validou'] || 0) / (metrics.totalClients || 1)) * 100}%` }}
                    className="bg-slate-300 h-full transition"
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                    <span>Em Processo ({metrics.statusesCount['Em Processamento de Recompensa'] || 0})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                    <span>Crédito Pago ({ (metrics.statusesCount['Recebido Total'] || 0) + (metrics.statusesCount['Cashback Recebido'] || 0) + (metrics.statusesCount['Indicação Recebida'] || 0) })</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Andamento ({ (metrics.statusesCount['Cadastrando'] || 0) + (metrics.statusesCount['Dados Pendentes'] || 0) })</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                    <span>Recusados ({metrics.statusesCount['Não Validou'] || 0})</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded mt-3 text-[10px] text-slate-500">
              Dica: Ajuste o status individual na lista para calcular novos bônus.
            </div>
          </div>

        </div>

        {/* Filters and Client Database Work Section */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Header Actions Table */}
          <div className="p-5 border-b border-slate-200 space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Registros de Clientes</h3>
                <p className="text-xs text-slate-500">
                  Acompanhamento individual de leads, whatsapp, cashbacks e canais de indicação.
                </p>
              </div>

              {/* Selection Tabs */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold self-start md:self-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Ver Todos
                </button>
                <button
                  onClick={() => setActiveTab('forecast')}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'forecast' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Previsão (Amanhã)
                </button>
                <button
                  onClick={() => setActiveTab('received')}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'received' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Recebidos
                </button>
                <button
                  onClick={() => setActiveTab('notValidated')}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'notValidated' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Não Validou
                </button>
              </div>
            </div>

            {/* Filters inputs line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Search Bar text */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, WhatsApp ou notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition"
                />
              </div>

              {/* Status Specific Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition appearance-none cursor-pointer text-slate-700 font-medium"
                >
                  <option value="all">Filtrar por Status (Todos)</option>
                  <option value="Cadastrando">Cadastrando</option>
                  <option value="Dados Pendentes">Dados Pendentes</option>
                  <option value="Em Processamento de Recompensa">Em Processamento de Recompensa</option>
                  <option value="Cashback Recebido">Cashback Recebido</option>
                  <option value="Indicação Recebida">Indicação Recebida</option>
                  <option value="Recebido Total">Recebido Total</option>
                  <option value="Não Validou">Não Validou</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              </div>

              {/* Info summary */}
              <div className="col-span-1 lg:col-span-2 flex items-center justify-end text-xs text-slate-450 gap-3">
                <span>Filtrados: <strong>{filteredClients.length}</strong> de <strong>{clients.length}</strong></span>
                { (searchTerm || statusFilter !== 'all' || activeTab !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setActiveTab('all');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* Database List / Table Grid */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-xs">Carregando carteira de clientes e status...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-4">
                <AlertCircle className="w-12 h-12 stroke-1 text-slate-300 mx-auto" strokeWidth={1.5} />
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">Nenhum cliente no filtro selecionado</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Crie um novo cliente utilizando o botão no topo, ou clique em &quot;Simular Caso Prático&quot; para preencher o sistema com as indicações exemplares!
                  </p>
                </div>
                {clients.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedExample}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-750 transition shadow-sm cursor-pointer"
                  >
                    Semeador Fácil
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Indicação / Proveniência</th>
                    <th className="px-6 py-4">Canal de Cadastro (Link)</th>
                    <th className="px-6 py-4 text-center">Cashback Atual</th>
                    <th className="px-6 py-4 text-center">Valor do Link Usado</th>
                    <th className="px-6 py-4">Status & Fluxo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredClients.map((c) => {
                    const status = statusDetails[c.status];
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/60 transition"
                      >
                        {/* Nome & Whatsapp clickable */}
                        <td className="px-6 py-4 max-w-[240px]">
                          <div>
                            <div className="font-bold text-slate-950 font-display text-sm">{c.name}</div>
                            
                            <div className="flex items-center gap-2 mt-1.5">
                              <a
                                href={formatWhatsappLink(c.whatsapp, c.name)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/50 px-2 py-0.5 rounded-md transition"
                                title="Falar no WhatsApp"
                              >
                                <Phone className="w-3 h-3 shrink-0" />
                                {c.whatsapp}
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* Indicação: Quem indicou (Cauê, etc) */}
                        <td className="px-6 py-4">
                          {c.referredBy ? (
                            <div>
                              <div className="font-semibold text-slate-800">{c.referredBy}</div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Indicou este cliente</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Nenhum indicador</span>
                          )}
                        </td>

                        {/* Link de Indicação do Cadastro & Proprios links */}
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {c.signupLinkOwner ? (
                                <span className="text-slate-800">{c.signupLinkOwner}</span>
                              ) : (
                                <span className="text-slate-400 italic font-normal">Link direto (Sem dono)</span>
                              )}
                            </div>
                            
                            {/* Client's own affiliate info */}
                            {c.inviteLink ? (
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="inline-block truncate max-w-[120px]" title={c.inviteLink}>
                                  Convite: {c.inviteLink}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.inviteLink || '');
                                    showToast('Link de convite copiado para a área de transferência!');
                                  }}
                                  className="text-slate-400 hover:text-emerald-600 p-0.5"
                                  title="Copiar link"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic block mt-0.5">Sem link próprio</span>
                            )}
                          </div>
                        </td>

                        {/* Specific Cashback allocated */}
                        <td className="px-6 py-4 text-center font-semibold text-slate-700">
                          <div>
                            {formatCurrency(c.cashbackAmount)}
                            <span className="text-[9px] text-slate-400 block font-normal">Fixo no cadastro</span>
                          </div>
                        </td>

                        {/* Value of invite link used */}
                        <td className="px-6 py-4 text-center font-bold text-indigo-700 font-mono">
                          {formatCurrency(c.signupLinkValue)}
                        </td>

                        {/* Status Select dropdown */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {/* Visual Current Badge */}
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold border ${status.bg} ${status.text} ${status.border}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            {/* Dropdown for quick updates */}
                            <select
                              value={c.status}
                              onChange={(e) => handleQuickStatusChange(c.id, e.target.value as ClientStatus)}
                              className="mt-1 text-[11px] block bg-slate-50 border border-slate-200 text-slate-700 rounded p-1 focus:outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                            >
                              <option value="Cadastrando">Cadastrando</option>
                              <option value="Dados Pendentes">Dados Pendentes</option>
                              <option value="Em Processamento de Recompensa">Em Processamento de Recompensa</option>
                              <option value="Cashback Recebido">Cashback Recebido</option>
                              <option value="Indicação Recebida">Indicação Recebida</option>
                              <option value="Recebido Total">Recebido Total</option>
                              <option value="Não Validou">Não Validou</option>
                            </select>
                          </div>
                        </td>

                        {/* Action buttons list */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEditClient(c)}
                              className="p-1 px-2 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition flex items-center gap-1 text-[10px] uppercase font-bold"
                              title="Editar todo o Cadastro"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteClient(c.id, c.name)}
                              className="p-1 px-2 rounded-md hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition flex items-center gap-1 text-[10px] uppercase font-bold"
                              title="Remover Registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {c.notes && (
                            <span
                              className="text-[10px] text-slate-400 block mt-1 max-w-[200px] truncate italic"
                              title={c.notes}
                            >
                              Obs: {c.notes}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
            <span className="font-mono text-[10px]">VPS Volume: database.json</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Sistemas de Controle pronto para Easypanel
            </div>
          </div>

        </div>

        {/* Detailed Financial Calculation Formula Explainer Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-3 shadow-xs">
          <h4 className="font-bold text-slate-800 flex items-center gap-1.5 font-display">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Entendendo os Métodos de Cálculo Financeiro:
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
            <li>
              <strong>Célula de Previsão de Recompensas:</strong> Se o cliente está no status de <strong className="text-blue-600 font-semibold bg-blue-50 px-1 rounded">Em Processamento de Recompensa</strong>, assumimos que os pagamentos de <strong>Cashback</strong> e do <strong>Link de Indicação</strong> correspondentes cairão no dia subsequente. Portanto, estes valores entram na previsão do dia seguinte.
            </li>
            <li>
              <strong>Troca de Parâmetros Globais:</strong> O Cashback é configurado de tempos em tempos. Ao criar um cliente novo, seu valor de Cashback é &quot;congelado&quot; no atual. Se as taxas globais mudarem no futuro, os clientes já cadastrados mantém o seu valor histórico salvo e protegido!
            </li>
            <li>
              <strong>Rigidez Status Recebidos (Valor Correto):</strong>
              <div className="mt-1 flex flex-col gap-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span>• Status <strong>Recebido Total</strong>: Soma integral de <code className="bg-white px-1 font-mono text-xs border border-slate-150">Cashback ({formatCurrency(config.defaultCashback)})</code> + <code className="bg-white px-1 font-mono text-xs border border-slate-150">Valor do Link de Indicação Usado</code>.</span>
                <span>• Status <strong>Cashback Recebido</strong>: Computa somente o valor do Cashback individual deste cliente.</span>
                <span>• Status <strong>Indicação Recebida</strong>: Computa somente o valor do link usado para cadastrar o cliente.</span>
              </div>
            </li>
          </ul>
        </section>
          </>
        )}

        {/* ==================================== LINKS TAB ==================================== */}
        {currentView === 'links' && (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-display">Canais e Links de Indicação para Cadastro</h2>
                  <p className="text-xs text-slate-500">
                    Cadastre e gerencie links usados por parceiros ou campanhas. Ao criar novos clientes, escolha um link cadastrado para receber o autofill de valores instantaneamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateLinkModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition shadow-sm text-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Novo Link de Indicação
                </button>
              </div>

              {signupLinks.length === 0 ? (
                <div className="text-center p-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <Link className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Nenhum Link de Indicação Cadastrado</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Crie canais para que os valores de comissão de link sejam aplicados dinamicamente na carteira de clientes.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-3">Canal / Criador</th>
                        <th className="px-6 py-3">Valor de Comissão do Link</th>
                        <th className="px-6 py-3">URL do Link</th>
                        <th className="px-6 py-3">Descrição / Notas</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {signupLinks.map((link) => (
                        <tr key={link.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4 font-bold text-slate-900 font-display">{link.name}</td>
                          <td className="px-6 py-4 font-mono text-blue-700 font-semibold">{formatCurrency(link.value)}</td>
                          <td className="px-6 py-4 text-slate-500 truncate max-w-xs" title={link.url}>
                            {link.url ? (
                              <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline text-blue-600 font-medium">
                                {link.url} <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="italic text-slate-300">Sem URL registrada</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate" title={link.notes || ''}>
                            {link.notes || <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => startEditLink(link)}
                                className="p-1 px-2.5 text-[11px] font-medium text-slate-650 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-md transition cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteLink(link.id, link.name)}
                                className="p-1 px-2.5 text-[11px] font-medium text-red-650 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-md transition cursor-pointer"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================== REFERRERS TAB ==================================== */}
        {currentView === 'referrers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-display">Parceiros e Indicadores de Clientes</h2>
                  <p className="text-xs text-slate-500">
                    Cadastre os influenciadores ou indicadores que recebem bônus direto pelas prospecções indicadas ao seu sistema.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateAgentModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition shadow-sm text-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Novo Parceiro / Indicador
                </button>
              </div>

              {referralAgents.length === 0 ? (
                <div className="text-center p-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <UserCheck className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Nenhum Parceiro Registrado</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Cadastre indicadores (como o Cauê) para controlar seus saldos de comissões e histórico de indicações de forma transparente.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-3">Nome do Indicador</th>
                        <th className="px-6 py-3">Comissão Acordada (Fixo)</th>
                        <th className="px-6 py-3">Indicações Vinculadas</th>
                        <th className="px-6 py-3">Observações</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {referralAgents.map((agent) => {
                        const linkedCount = clients.filter(c => c.referredBy === agent.name).length;
                        return (
                          <tr key={agent.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-6 py-4 font-bold text-slate-900 font-display">{agent.name}</td>
                            <td className="px-6 py-4 font-mono text-emerald-750 font-semibold">{formatCurrency(agent.commissionValue)}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium text-[11px]">
                                {linkedCount} clientes indicados
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 max-w-xs truncate" title={agent.notes || ''}>
                              {agent.notes || <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => startEditAgent(agent)}
                                  className="p-1 px-2.5 text-[11px] font-medium text-slate-650 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-md transition cursor-pointer"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteAgent(agent.id, agent.name)}
                                  className="p-1 px-2.5 text-[11px] font-medium text-red-650 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-md transition cursor-pointer"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================== CUSTOM REPORT TAB ==================================== */}
        {currentView === 'reports' && (
          <div className="space-y-6">
            
            {/* Control Panel Card */}
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800 font-display">Filtros & Customização de Relatórios</h2>
                  <p className="text-xs text-slate-500 font-sans">Gere relatórios personalizáveis, configure agrupamento por colunas e filtre períodos de cadastro.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleExportCSV}
                    disabled={reportFilteredClients.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Exportar Planilha (Excel CSV)
                  </button>
                  <button
                    onClick={() => window.print()}
                    disabled={reportFilteredClients.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Imprimir Relatório
                  </button>
                </div>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Período de Início</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Período Final</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Status do Cliente</label>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    <option value="all">Todos os Statuses</option>
                    <option value="Cadastrando">Cadastrando</option>
                    <option value="Dados Pendentes">Dados Pendentes</option>
                    <option value="Em Processamento de Recompensa">Em Processamento de Recompensa</option>
                    <option value="Cashback Recebido">Cashback Recebido</option>
                    <option value="Indicação Recebida">Indicação Recebida</option>
                    <option value="Recebido Total">Recebido Total</option>
                    <option value="Não Validou">Não Validou</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Agrupar Por (Pivot)</label>
                  <select
                    value={reportGroupBy}
                    onChange={(e) => setReportGroupBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    <option value="none">Nenhum (Lista Plana)</option>
                    <option value="status">Status do Cliente</option>
                    <option value="link">Canal de Cadastro (Link)</option>
                    <option value="referrer">Indicador Direto</option>
                  </select>
                </div>
              </div>

              {/* Column selection toggles */}
              <div className="pt-3 border-t border-slate-100">
                <span className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Colunas para Exibição no Relatório</span>
                <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.name}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, name: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Nome do Cliente
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.whatsapp}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, whatsapp: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    WhatsApp
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.status}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, status: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Status Atual
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.cashback}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, cashback: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Valor Cashback
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.linkValue}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, linkValue: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Valor do Link de Cadastro
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.totalBonus}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, totalBonus: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-505"
                    />
                    Soma Recompensa Unificada
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportedColumns.createdAt}
                      onChange={(e) => setReportedColumns({ ...reportedColumns, createdAt: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-505"
                    />
                    Data de Cadastro
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Metrics display inside the active report filter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-205 p-4 rounded-xl shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Clientes Filtrados</span>
                <p className="text-xl font-bold text-slate-850">{reportMetrics.count} clientes</p>
                <span className="text-[10px] text-slate-405 mt-1 block">Na seleção atual</span>
              </div>
              <div className="bg-white border border-slate-205 p-4 rounded-xl shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-sans">Total de Cashback</span>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(reportMetrics.totalCashback)}</p>
                <span className="text-[10px] text-slate-405 mt-1 block">R$ a ser pago / pago</span>
              </div>
              <div className="bg-white border border-slate-205 p-4 rounded-xl shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-sans">Total com Link de Cadastro</span>
                <p className="text-xl font-bold text-indigo-600">{formatCurrency(reportMetrics.totalLinkValue)}</p>
                <span className="text-[10px] text-slate-405 mt-1 block">R$ gerado por links</span>
              </div>
              <div className="bg-white border border-slate-205 p-4 rounded-xl shadow-xs bg-slate-900 text-white border-none">
                <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Saldo de Retorno Geral</span>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(reportMetrics.totalValue)}</p>
                <span className="text-[10px] text-slate-300 mt-1 block font-sans">Soma de recompensas</span>
              </div>
            </div>

            {/* Graphical visual representation block */}
            {reportGroupBy !== 'none' && reportGroupedData.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-display">Representação Gráfica por Grupos (Pivot)</h3>
                <div className="space-y-4">
                  {reportGroupedData.map((group) => {
                    const percentage = reportMetrics.totalValue > 0 ? (group.total / reportMetrics.totalValue) * 100 : 0;
                    return (
                      <div key={group.key} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">{group.key} <span className="font-medium text-slate-400">({group.count} clis)</span></span>
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(group.total)} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-sans">
                          <span>Cashback: {formatCurrency(group.cashback)}</span>
                          <span>Comissionamento do Canal: {formatCurrency(group.linkValue)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Report Output Layout */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display">Dados Gerados ({reportFilteredClients.length} linhas)</span>
                {reportGroupBy !== 'none' && (
                  <span className="text-[11px] text-slate-500 bg-slate-200/65 px-2 py-0.5 rounded font-medium">Visualização Pivot Agrupada: ({reportGroupBy})</span>
                )}
              </div>

              {reportFilteredClients.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Sem dados correspondentes aos filtros selecionados.</p>
                </div>
              ) : reportGroupBy !== 'none' ? (
                // Display Grouped View
                <div className="divide-y divide-slate-200">
                  {reportGroupedData.map((group) => (
                    <div key={group.key} className="p-4 space-y-3 bg-white">
                      <div className="flex justify-between items-center bg-slate-50/80 p-2.5 px-3 rounded-lg border border-slate-150">
                        <span className="text-xs font-bold text-slate-800 font-display">Grupo: {group.key}</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span>Integrantes: <strong className="text-slate-900">{group.count}</strong></span>
                          <span>Subtotal Recompensas: <strong className="text-blue-700 font-mono">{formatCurrency(group.total)}</strong></span>
                        </div>
                      </div>
                      <div className="overflow-x-auto pl-2">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="text-slate-400 font-bold border-b border-slate-150 text-[10px] uppercase">
                              {reportedColumns.name && <th className="py-2 px-2">Cliente</th>}
                              {reportedColumns.whatsapp && <th className="py-2 px-2">WhatsApp</th>}
                              {reportedColumns.status && <th className="py-2 px-2">Status</th>}
                              {reportedColumns.cashback && <th className="py-2 px-2 text-right">Cashback</th>}
                              {reportedColumns.linkValue && <th className="py-2 px-2 text-right">Valor Link</th>}
                              {reportedColumns.totalBonus && <th className="py-2 px-2 text-right">Total Acumulado</th>}
                              {reportedColumns.createdAt && <th className="py-2 px-2 text-right">Cadastro</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {group.clients.map(c => {
                              let totalAcumuladoSum = 0;
                              if (c.status === 'Recebido Total' || c.status === 'Em Processamento de Recompensa') {
                                totalAcumuladoSum = c.cashbackAmount + c.signupLinkValue;
                              } else if (c.status === 'Cashback Recebido') {
                                totalAcumuladoSum = c.cashbackAmount;
                              } else if (c.status === 'Indicação Recebida') {
                                totalAcumuladoSum = c.signupLinkValue;
                              }
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                                  {reportedColumns.name && <td className="py-2 px-2 font-semibold text-slate-800">{c.name}</td>}
                                  {reportedColumns.whatsapp && <td className="py-2 px-2 text-slate-550 font-mono">{c.whatsapp}</td>}
                                  {reportedColumns.status && <td className="py-2 px-2"><span className="text-[10px] text-slate-500 font-medium bg-slate-100 p-0.5 px-1.5 rounded">{c.status}</span></td>}
                                  {reportedColumns.cashback && <td className="py-2 px-2 text-right font-mono text-slate-650">{formatCurrency(c.cashbackAmount)}</td>}
                                  {reportedColumns.linkValue && <td className="py-2 px-2 text-right font-mono text-slate-650">{formatCurrency(c.signupLinkValue)}</td>}
                                  {reportedColumns.totalBonus && <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(totalAcumuladoSum)}</td>}
                                  {reportedColumns.createdAt && <td className="py-2 px-2 text-right text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Display Flat List Table View
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                        {reportedColumns.name && <th className="px-6 py-3">Cliente</th>}
                        {reportedColumns.whatsapp && <th className="px-6 py-3">WhatsApp</th>}
                        {reportedColumns.status && <th className="px-6 py-3">Status</th>}
                        {reportedColumns.cashback && <th className="px-6 py-3 text-right">Cashback</th>}
                        {reportedColumns.linkValue && <th className="px-6 py-3 text-right">Valor Link</th>}
                        {reportedColumns.totalBonus && <th className="px-6 py-3 text-right font-display text-slate-500">Soma Recompensas</th>}
                        {reportedColumns.createdAt && <th className="px-6 py-3 text-right font-sans">Cadastro</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {reportFilteredClients.map(c => {
                        let totalAcumuladoSum = 0;
                        if (c.status === 'Recebido Total' || c.status === 'Em Processamento de Recompensa') {
                          totalAcumuladoSum = c.cashbackAmount + c.signupLinkValue;
                        } else if (c.status === 'Cashback Recebido') {
                          totalAcumuladoSum = c.cashbackAmount;
                        } else if (c.status === 'Indicação Recebida') {
                          totalAcumuladoSum = c.signupLinkValue;
                        }
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/60 transition">
                            {reportedColumns.name && <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>}
                            {reportedColumns.whatsapp && <td className="px-6 py-4 font-mono text-slate-500">{c.whatsapp}</td>}
                            {reportedColumns.status && (
                              <td className="px-6 py-4">
                                <span className="inline-block text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-650 font-medium font-sans">
                                  {c.status}
                                </span>
                              </td>
                            )}
                            {reportedColumns.cashback && <td className="px-6 py-4 text-right font-mono text-slate-650">{formatCurrency(c.cashbackAmount)}</td>}
                            {reportedColumns.linkValue && <td className="px-6 py-4 text-right font-mono text-slate-650">{formatCurrency(c.signupLinkValue)}</td>}
                            {reportedColumns.totalBonus && <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatCurrency(totalAcumuladoSum)}</td>}
                            {reportedColumns.createdAt && <td className="px-6 py-4 text-right text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* FOOTER COOLDOWN INFO */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-auto">
        <p>© {new Date().getFullYear()} RewardsControl - Painel de Controle de Recompensas. Pronto para implantar no EasyPanel no seu servidor VPS.</p>
      </footer>


      {/* =========================================================================
                                     MODALS & PANELS
         ========================================================================= */}

      {/* MODAL 1: ADD CLIENT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              
              {/* Overlay background */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddModalOpen(false)}
                className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-2xs"
              />

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100 sm:align-middle"
              >
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Cadastrar Novo Cliente
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-1.5 text-slate-400 rounded-md hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateClient} className="my-4 space-y-4">
                  
                  {/* Basic Client Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Nome do Cliente *
                      </label>
                      <input
                        type="text"
                        required
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Ex: Verônica Santos"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        WhatsApp (Celular) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newClientWhatsapp}
                        onChange={(e) => setNewClientWhatsapp(e.target.value)}
                        placeholder="Ex: 21999998888"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Referral Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Quem Indicou?
                      </label>
                      <select
                        value={referralAgents.some(agent => agent.name === newClientReferredBy) ? newClientReferredBy : (newClientReferredBy ? "custom" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setNewClientReferredBy("");
                          } else {
                            setNewClientReferredBy(val);
                          }
                        }}
                        className="w-full text-xs px-3.5 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition mb-2"
                      >
                        <option value="">Sem Indicador (Direto)</option>
                        {referralAgents.map(agent => (
                          <option key={agent.id} value={agent.name}>{agent.name} (R$ {agent.commissionValue})</option>
                        ))}
                        <option value="custom">✍️ Digitar personalizado...</option>
                      </select>
                      {(referralAgents.length === 0 || !referralAgents.some(agent => agent.name === newClientReferredBy)) && (
                        <input
                          type="text"
                          value={newClientReferredBy}
                          onChange={(e) => setNewClientReferredBy(e.target.value)}
                          placeholder="Nome do Indicador"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition"
                        />
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">Quem realizou a indicação direta</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Dono do Link de Cadastro
                      </label>
                      <select
                        value={signupLinks.some(link => link.name === newClientSignupLinkOwner) ? newClientSignupLinkOwner : (newClientSignupLinkOwner ? "custom" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setNewClientSignupLinkOwner("");
                          } else {
                            setNewClientSignupLinkOwner(val);
                            const matched = signupLinks.find(link => link.name === val);
                            if (matched) {
                              setNewClientSignupLinkValue(matched.value.toString());
                            }
                          }
                        }}
                        className="w-full text-xs px-3.5 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition mb-2"
                      >
                        <option value="">Nenhum / Direto</option>
                        {signupLinks.map(link => (
                          <option key={link.id} value={link.name}>{link.name} (R$ {link.value})</option>
                        ))}
                        <option value="custom">✍️ Digitar personalizado...</option>
                      </select>
                      {(signupLinks.length === 0 || !signupLinks.some(link => link.name === newClientSignupLinkOwner)) && (
                        <input
                          type="text"
                          value={newClientSignupLinkOwner}
                          onChange={(e) => setNewClientSignupLinkOwner(e.target.value)}
                          placeholder="Dono do Link"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition"
                        />
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">Cupom / Link de cadastro usado</span>
                    </div>
                  </div>

                  {/* Invite Link Valor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Valor do Convite Usado (R$)
                      </label>
                      <input
                        type="number"
                        value={newClientSignupLinkValue}
                        onChange={(e) => setNewClientSignupLinkValue(e.target.value)}
                        placeholder="Valor pago à Márcia pelo link"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">R$ cobrado por este link do padrinho</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Congelar Cashback Atual em
                      </label>
                      <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs flex justify-between items-center text-emerald-800 font-semibold">
                        <span>Valor do Cashback:</span>
                        <span>{formatCurrency(config.defaultCashback)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">Este cashback não sofrerá retrocesso posterior.</span>
                    </div>
                  </div>

                  {/* Convites Próprios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Link de Convite Próprio
                      </label>
                      <input
                        type="text"
                        value={newClientInviteLink}
                        onChange={(e) => setNewClientInviteLink(e.target.value)}
                        placeholder="Ex: https://seusite.com/c/veronica"
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">
                        Valor do Convite Próprio (R$)
                      </label>
                      <input
                        type="number"
                        value={newClientOwnInviteValue}
                        onChange={(e) => setNewClientOwnInviteValue(e.target.value)}
                        placeholder="Padrão do sistema..."
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Observação / Anotações
                    </label>
                    <textarea
                      value={newClientNotes}
                      onChange={(e) => setNewClientNotes(e.target.value)}
                      placeholder="Anote detalhes de faturamento, prazos..."
                      rows={3}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                    />
                  </div>

                  {/* Buttons line */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition"
                    >
                      Cadastrar Cliente
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDIT CLIENT MODAL */}
      <AnimatePresence>
        {isEditModalOpen && selectedClient && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditModalOpen(false)}
                className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-2xs"
              />

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100 sm:align-middle"
              >
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Editar Cadastro do Cliente
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-1.5 text-slate-400 rounded-md hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleEditClient} className="my-4 space-y-4">
                  
                  {/* Status & Date flow heading */}
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">Configurar Status Atual:</span>
                      <span className="text-[10px] text-indigo-600">Última atualização: {formatDate(selectedClient.statusUpdatedAt)}</span>
                    </div>
                    <select
                      value={editClientStatus}
                      onChange={(e) => setEditClientStatus(e.target.value as ClientStatus)}
                      className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg focus:outline-none font-semibold text-slate-800"
                    >
                      <option value="Cadastrando">Cadastrando</option>
                      <option value="Dados Pendentes">Dados Pendentes</option>
                      <option value="Em Processamento de Recompensa">Em Processamento de Recompensa</option>
                      <option value="Cashback Recebido">Cashback Recebido</option>
                      <option value="Indicação Recebida">Indicação Recebida</option>
                      <option value="Recebido Total">Recebido Total</option>
                      <option value="Não Validou">Não Validou</option>
                    </select>
                    <p className="text-[10px] text-indigo-700 leading-tight">
                      {statusDetails[editClientStatus].description}
                    </p>
                  </div>

                  {/* Basic Client Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Nome do Cliente *
                      </label>
                      <input
                        type="text"
                        required
                        value={editClientName}
                        onChange={(e) => setEditClientName(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        WhatsApp (Celular) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editClientWhatsapp}
                        onChange={(e) => setEditClientWhatsapp(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Referrals */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Quem Indicou?
                      </label>
                      <select
                        value={referralAgents.some(agent => agent.name === editClientReferredBy) ? editClientReferredBy : (editClientReferredBy ? "custom" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setEditClientReferredBy("");
                          } else {
                            setEditClientReferredBy(val);
                          }
                        }}
                        className="w-full text-xs px-3.5 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition mb-2"
                      >
                        <option value="">Sem Indicador (Direto)</option>
                        {referralAgents.map(agent => (
                          <option key={agent.id} value={agent.name}>{agent.name} (R$ {agent.commissionValue})</option>
                        ))}
                        <option value="custom">✍️ Digitar personalizado...</option>
                      </select>
                      {(referralAgents.length === 0 || !referralAgents.some(agent => agent.name === editClientReferredBy)) && (
                        <input
                          type="text"
                          value={editClientReferredBy}
                          onChange={(e) => setEditClientReferredBy(e.target.value)}
                          placeholder="Nome do Indicador"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Dono do Link de Cadastro
                      </label>
                      <select
                        value={signupLinks.some(link => link.name === editClientSignupLinkOwner) ? editClientSignupLinkOwner : (editClientSignupLinkOwner ? "custom" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setEditClientSignupLinkOwner("");
                          } else {
                            setEditClientSignupLinkOwner(val);
                            const matched = signupLinks.find(link => link.name === val);
                            if (matched) {
                              setEditClientSignupLinkValue(matched.value);
                            }
                          }
                        }}
                        className="w-full text-xs px-3.5 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition mb-2"
                      >
                        <option value="">Nenhum / Direto</option>
                        {signupLinks.map(link => (
                          <option key={link.id} value={link.name}>{link.name} (R$ {link.value})</option>
                        ))}
                        <option value="custom">✍️ Digitar personalizado...</option>
                      </select>
                      {(signupLinks.length === 0 || !signupLinks.some(link => link.name === editClientSignupLinkOwner)) && (
                        <input
                          type="text"
                          value={editClientSignupLinkOwner}
                          onChange={(e) => setEditClientSignupLinkOwner(e.target.value)}
                          placeholder="Dono do Link"
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-650 transition"
                        />
                      )}
                    </div>
                  </div>

                  {/* Financial configuration items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Valor do Convite Usado (R$)
                      </label>
                      <input
                        type="number"
                        value={editClientSignupLinkValue}
                        onChange={(e) => setEditClientSignupLinkValue(Number(e.target.value))}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Cashback Registrado (R$)
                      </label>
                      <input
                        type="number"
                        value={editClientCashback}
                        onChange={(e) => setEditClientCashback(Number(e.target.value))}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                      <span className="text-[9px] text-slate-400 block mt-1">Conforme solicitado, modifique este cashback mantendo congelamentos retroativos.</span>
                    </div>
                  </div>

                  {/* Link Próprio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Link de Convite Próprio
                      </label>
                      <input
                        type="text"
                        value={editClientInviteLink}
                        onChange={(e) => setEditClientInviteLink(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        Valor do Convite Próprio (R$)
                      </label>
                      <input
                        type="number"
                        value={editClientOwnInviteValue}
                        onChange={(e) => setEditClientOwnInviteValue(Number(e.target.value))}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Notes fields */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Observação / Anotações
                    </label>
                    <textarea
                      value={editClientNotes}
                      onChange={(e) => setEditClientNotes(e.target.value)}
                      rows={3}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                    />
                  </div>

                  {/* Form actions footer */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditModalOpen(false);
                        setSelectedClient(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-505 rounded-xl shadow-xs transition"
                    >
                      Salvar Cadastro
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: GLOBAL CONFIG RATES */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConfigModalOpen(false)}
                className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-2xs"
              />

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="inline-block w-full max-w-sm p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100 sm:align-middle"
              >
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      Configurar Taxas Globais
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsConfigModalOpen(false)}
                    className="p-1.5 text-slate-400 rounded-md hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveConfig} className="my-4 space-y-4">
                  
                  <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl text-amber-900 text-xs flex gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="leading-tight">
                      <strong>Atenção:</strong> Alterar as taxas agora afetará apenas <strong>novos cadastros</strong>. O Cashback e valor de indicação dos clientes já registrados estão salvos com segurança para não houver qualquer alteração retroativa!
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Cashback Padrão do Sistema (R$)
                    </label>
                    <input
                      type="number"
                      required
                      value={cfgCashback}
                      onChange={(e) => setCfgCashback(e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Valor Padrão de Link de Convite (R$)
                    </label>
                    <input
                      type="number"
                      required
                      value={cfgInviteValue}
                      onChange={(e) => setCfgInviteValue(e.target.value)}
                      placeholder="Ex: 30"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Comissão Geral de Indicação (R$)
                    </label>
                    <input
                      type="number"
                      required
                      value={cfgReferralCommission}
                      onChange={(e) => setCfgReferralCommission(e.target.value)}
                      placeholder="Ex: 40"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-semibold"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition"
                    >
                      Salvar Regras
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: SIGNUP LINK MODAL (CREATE / EDIT) */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLinkModalOpen(false)}
                className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-2xs"
              />

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100 sm:align-middle"
              >
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <Link className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      {editingLink ? 'Editar Link de Indicação' : 'Novo Link de Indicação'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsLinkModalOpen(false)}
                    className="p-1.5 text-slate-400 rounded-md hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveLink} className="my-4 space-y-4">
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Canal / Criador do Link *
                    </label>
                    <input
                      type="text"
                      required
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      placeholder="Ex: Márcia, Insta-Influencer, Facebook Ads"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Valor de Indicação do Link (R$) *
                    </label>
                    <input
                      type="number"
                      required
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full text-xs px-3.5 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      URL de Cadastro (Opcional)
                    </label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://exemplo.com/cadastro?ref=marcia"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Observações / Notas
                    </label>
                    <textarea
                      value={linkNotes}
                      onChange={(e) => setLinkNotes(e.target.value)}
                      placeholder="Anotações internas sobre as condições acordadas..."
                      rows={2}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsLinkModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      {editingLink ? 'Salvar Alterações' : 'Criar Link'}
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: REFERRAL AGENT MODAL (CREATE / EDIT) */}
      <AnimatePresence>
        {isAgentModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAgentModalOpen(false)}
                className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-2xs"
              />

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100 sm:align-middle"
              >
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      {editingAgent ? 'Editar Parceiro / Indicador' : 'Novo Parceiro / Indicador'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAgentModalOpen(false)}
                    className="p-1.5 text-slate-400 rounded-md hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveAgent} className="my-4 space-y-4">
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Nome do Parceiro / Indicador *
                    </label>
                    <input
                      type="text"
                      required
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Ex: Cauê Souza, João Silva"
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Valor de Comissão Fixa por Indicação (R$) *
                    </label>
                    <input
                      type="number"
                      required
                      value={agentCommission}
                      onChange={(e) => setAgentCommission(e.target.value)}
                      placeholder="Ex: 40"
                      className="w-full text-xs px-3.5 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Observações / Contato
                    </label>
                    <textarea
                      value={agentNotes}
                      onChange={(e) => setAgentNotes(e.target.value)}
                      placeholder="Telefone, e-mail ou dados para transferência..."
                      rows={2}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsAgentModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      {editingAgent ? 'Salvar Alterações' : 'Registrar Parceiro'}
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
