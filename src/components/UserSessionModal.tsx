// src/components/UserSessionModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Calendar, 
  Download, 
  Activity,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { User } from '@/types/auth';
import { getUserSessionHistory, UserSession } from '@/services/userService';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interface étendue pour l'utilisateur avec les champs supplémentaires
// Sans redéclarer les propriétés de User pour éviter les conflits
interface ExtendedUser extends User {
  full_name?: string;
  // On ne redéclare PAS 'name' car elle existe déjà dans User
}

interface UserSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ExtendedUser;
}

const UserSessionModal: React.FC<UserSessionModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Statistiques calculées
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalHours: 0,
    averagePerDay: 0,
    lastConnection: null as string | null,
    mostActiveDay: null as string | null
  });

  useEffect(() => {
    if (isOpen && user) {
      loadSessions();
    }
  }, [isOpen, user, dateRange, startDate, endDate]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      let actualStartDate = startDate;
      let actualEndDate = endDate;

      if (dateRange === 'week') {
        actualStartDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        actualEndDate = format(new Date(), 'yyyy-MM-dd');
      } else if (dateRange === 'month') {
        actualStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        actualEndDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      }

      const data = await getUserSessionHistory({
        user_id: user.id,
        start_date: actualStartDate,
        end_date: actualEndDate,
        limit: 100
      });

      setSessions(data);
      calculateStats(data);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sessionsData: UserSession[]) => {
    const totalSessions = sessionsData.length;
    const totalHours = sessionsData.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60;
    const averagePerDay = totalSessions > 0 ? totalHours / totalSessions : 0;

    // Trouver le jour le plus actif
    const daysCount: Record<string, number> = {};
    sessionsData.forEach(s => {
      const day = format(new Date(s.login_time), 'yyyy-MM-dd');
      daysCount[day] = (daysCount[day] || 0) + 1;
    });

    let mostActiveDay = null;
    let maxCount = 0;
    Object.entries(daysCount).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = day;
      }
    });

    setStats({
      totalSessions,
      totalHours: Math.round(totalHours * 10) / 10,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      lastConnection: sessionsData[0]?.login_time || null,
      mostActiveDay
    });
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Fonction pour obtenir le nom d'affichage
  const getDisplayName = (): string => {
    // Utiliser full_name si disponible, sinon name (qui existe dans User), sinon email
    return user.full_name || user.name || user.email || 'Utilisateur';
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Historique des sessions - ${getDisplayName()}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Période: du ${startDate} au ${endDate}`, 14, 30);
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 36);

    // Statistiques
    doc.setFontSize(12);
    doc.text('Résumé', 14, 48);
    doc.setFontSize(10);
    doc.text(`Total sessions: ${stats.totalSessions}`, 14, 56);
    doc.text(`Heures totales: ${stats.totalHours}h`, 14, 62);
    doc.text(`Moyenne par jour: ${stats.averagePerDay}h`, 14, 68);

    // Tableau des sessions
    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Connexion', 'Déconnexion', 'Durée', 'Pharmacie', 'Branche']],
      body: sessions.map(s => [
        format(new Date(s.login_time), 'dd/MM/yyyy'),
        format(new Date(s.login_time), 'HH:mm'),
        s.logout_time ? format(new Date(s.logout_time), 'HH:mm') : 'En cours',
        formatDuration(s.duration_minutes),
        s.pharmacy_id?.substring(0, 8) || 'N/A',
        s.branch_id?.substring(0, 8) || 'Principale'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`sessions_${user.id}_${startDate}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
        
        {/* En-tête */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-blue-500/5 to-transparent">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
              SESSIONS - <span className="text-blue-600">{getDisplayName()}</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Historique des connexions et présence
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            type="button"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Filtres */}
        <div className="px-6 pt-4 flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setDateRange('week')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                dateRange === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
              type="button"
            >
              Semaine
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                dateRange === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
              type="button"
            >
              Mois
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                dateRange === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
              type="button"
            >
              Personnalisé
            </button>
          </div>

          {dateRange === 'all' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </>
          )}

          <button
            onClick={loadSessions}
            className="ml-auto p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Rafraîchir"
            type="button"
          >
            <RefreshCw size={16} className="text-slate-400" />
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-colors"
            type="button"
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50/50 border-b border-slate-100">
          <div className="bg-white p-3 rounded-xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total sessions</p>
            <p className="text-xl font-black text-slate-900">{stats.totalSessions}</p>
          </div>
          <div className="bg-white p-3 rounded-xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Heures totales</p>
            <p className="text-xl font-black text-slate-900">{stats.totalHours}h</p>
          </div>
          <div className="bg-white p-3 rounded-xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Moyenne/jour</p>
            <p className="text-xl font-black text-slate-900">{stats.averagePerDay}h</p>
          </div>
          <div className="bg-white p-3 rounded-xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dernière connexion</p>
            <p className="text-sm font-black text-slate-900">
              {stats.lastConnection ? format(new Date(stats.lastConnection), 'dd/MM/yyyy') : 'N/A'}
            </p>
          </div>
        </div>

        {/* Liste des sessions */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Activity size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium">Aucune session trouvée pour cette période</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <div
                  key={session.id || `session-${index}`}
                  className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <LogIn size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span className="text-xs font-medium">
                            {format(new Date(session.login_time), 'EEEE d MMMM yyyy', { locale: fr })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-xs">
                            <LogIn size={10} className="text-green-600" />
                            <span>{format(new Date(session.login_time), 'HH:mm')}</span>
                          </div>
                          {session.logout_time ? (
                            <div className="flex items-center gap-1 text-xs">
                              <LogOut size={10} className="text-red-600" />
                              <span>{format(new Date(session.logout_time), 'HH:mm')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              En cours
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-xs font-bold">
                            <Clock size={10} className="text-slate-400" />
                            <span>{formatDuration(session.duration_minutes)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {session.ip_address && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin size={10} />
                        {session.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSessionModal;