export type ClientStatus =
  | 'Cadastrando'
  | 'Dados Pendentes'
  | 'Em Processamento de Recompensa'
  | 'Cashback Recebido'
  | 'Indicação Recebida'
  | 'Recebido Total'
  | 'Não Validou';

export interface AppConfig {
  defaultCashback: number; // Global default cashback
  defaultInviteValue: number; // Global default registration link value
  defaultReferralCommission: number; // Global default referral value
}

export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  referredBy?: string; // Who recommended/referred them (e.g., Cauê)
  signupLinkOwner?: string; // Whose signup link was used (e.g., Márcia)
  signupLinkValue: number; // Commission value assigned to that link at registration (Valor do Convite/Link)
  inviteLink?: string; // The client's own invite link for others to use
  ownInviteValue: number; // Value of this client's invitation link (defaults to defaultInviteValue)
  notes?: string; // Observations
  status: ClientStatus;
  cashbackAmount: number; // The cashback amount frozen at the time this client registered
  createdAt: string;
  statusUpdatedAt: string;
}

export interface SignupLink {
  id: string;
  name: string;
  value: number;
  url?: string;
  notes?: string;
  createdAt: string;
}

export interface ReferralAgent {
  id: string;
  name: string;
  commissionValue: number;
  notes?: string;
  createdAt: string;
}

export interface DatabaseState {
  config: AppConfig;
  clients: Client[];
  signupLinks?: SignupLink[];
  referralAgents?: ReferralAgent[];
}
