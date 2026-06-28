import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const SUPABASE_URL = 'https://kfohwrssrnblilcqpjdc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XdMFEv2ae8gCKYewTuOI_g_Xkr_PPqn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
