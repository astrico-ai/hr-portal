// Backend switch for the generic data layer. Defaults to Firebase so the live
// app is unaffected during the migration. Set REACT_APP_DATA_BACKEND=supabase
// (in .env.local) to run the whole app against Supabase for testing/cutover.
import * as firebaseImpl from './firebaseService';
import * as supabaseImpl from './supabaseService';

const backend = (process.env.REACT_APP_DATA_BACKEND || 'firebase').toLowerCase();
const impl = backend === 'supabase' ? supabaseImpl : firebaseImpl;

// eslint-disable-next-line no-console
if (backend === 'supabase') console.info('[data] using Supabase backend');

export const getDocument = impl.getDocument;
export const getDocuments = impl.getDocuments;
export const setDocument = impl.setDocument;
export const updateDocument = impl.updateDocument;
export const deleteDocument = impl.deleteDocument;
export const queryDocuments = impl.queryDocuments;
