// components/dashboard/AllPlatforms.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService, UserSession, SessionSalesResponse } from '@/services/sessionService';
import useDashboard from '@/hooks/useDashboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Smartphone,
  Monitor,
  Tablet,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  MapPin,
  Chrome,
  Apple,
  LayoutGrid,
  LogOut,
  RefreshCw,
} from 'lucide-react';

// Constantes
const PLATFORM_ICONS = {
  web: <Monitor className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  pos: <ShoppingCart className="h-4 w-4" />,
  pwa: <LayoutGrid className="h-4 w-4" />,
} as const;

const PLATFORM_COLORS = {
  web: '#3b82f6',
  mobile: '#10b981',
  tablet: '#f59e0b',
  pos: '#ef4444',
  pwa: '#8b5cf6',
} as const;

const SCROLL_AREA_HEIGHT = 500;
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface PlatformStats {
  platform: string;
  sessions: number;
  sales: number;
  revenue: number;
  averageBasket: number;
}

export const AllPlatforms: React.FC = () => {
  const queryClient = useQueryClient();
  const { formattedStats } = useDashboard();
  const [sessionSales, setSessionSales] = useState<SessionSalesResponse | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [currentSessionForDialog, setCurrentSessionForDialog] = useState<UserSession | null>(null);

  // Récupérer toutes les sessions
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: () => sessionService.getUserSessions(true),
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enregistrer la session actuelle au montage
  useEffect(() => {
    const registerCurrentSession = async () => {
      try {
        let ipInfo: { city?: string; country?: string } = {};
        try {
          const ipResponse = await fetch('https://ipapi.co/json/');
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            ipInfo = {
              city: ipData.city,
              country: ipData.country_name,
            };
          }
        } catch {
          // Ignorer les erreurs de géolocalisation
        }

        await sessionService.registerSession(ipInfo);
        
        const interval = setInterval(() => {
          sessionService.updateSessionActivity();
        }, SESSION_REFRESH_INTERVAL);

        return () => clearInterval(interval);
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la session:', error);
      }
    };

    registerCurrentSession();
  }, []);

  // Mutation pour déconnecter une session
  const logoutSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionService.logoutSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });

  // Charger les ventes d'une session
  const loadSessionSales = useCallback(async (session: UserSession) => {
    setCurrentSessionForDialog(session);
    setLoadingSales(true);
    try {
      const sales = await sessionService.getSessionSales(session.session_id);
      setSessionSales(sales);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  // Calculer les statistiques par plateforme
  const platformStats = useMemo((): PlatformStats[] => {
    if (!sessionsData?.sessions) return [];

    const statsByPlatform = new Map<string, PlatformStats>();

    sessionsData.sessions.forEach(session => {
      const platform = session.platform;
      if (!statsByPlatform.has(platform)) {
        statsByPlatform.set(platform, {
          platform,
          sessions: 0,
          sales: 0,
          revenue: 0,
          averageBasket: 0,
        });
      }

      const current = statsByPlatform.get(platform)!;
      current.sessions++;
    });

    return Array.from(statsByPlatform.values());
  }, [sessionsData]);

  // Données pour le graphique des sessions par plateforme
  const sessionsByPlatformData = useMemo(() => {
    return platformStats.map(stat => ({
      name: stat.platform.toUpperCase(),
      value: stat.sessions,
      color: PLATFORM_COLORS[stat.platform as keyof typeof PLATFORM_COLORS] || '#6b7280',
    }));
  }, [platformStats]);

  // Formater la date
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Obtenir l'icône de la plateforme
  const getPlatformIcon = useCallback((platform: string) => {
    return PLATFORM_ICONS[platform as keyof typeof PLATFORM_ICONS] || <Monitor className="h-4 w-4" />;
  }, []);

  // Obtenir le badge de statut
  const getStatusBadge = useCallback((isActive: boolean, expiresAt: string) => {
    if (!isActive) {
      return <Badge variant="secondary">Déconnectée</Badge>;
    }
    const expires = new Date(expiresAt);
    if (expires < new Date()) {
      return <Badge variant="destructive">Expirée</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  }, []);

  // Calcul du panier moyen
  const averageBasket = useMemo(() => {
    if (formattedStats?.monthly_sales && sessionsData?.active_count) {
      return Math.round(formattedStats.monthly_sales / (sessionsData.active_count || 1));
    }
    return 0;
  }, [formattedStats, sessionsData]);

  // Filtrage des sessions actives
  const activeSessions = useMemo(() => {
    if (!sessionsData?.sessions) return [];
    return sessionsData.sessions.filter(
      s => s.is_active && new Date(s.expires_at) > new Date()
    );
  }, [sessionsData]);

  if (sessionsLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Chargement des sessions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sessions multi-plateformes</h2>
          <p className="text-muted-foreground">
            Suivez votre activité sur tous vos appareils (téléphone, tablette, ordinateur, POS)
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchSessions()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Statistiques globales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionsData?.active_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              sur {sessionsData?.total_count || 0} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plateformes utilisées</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformStats.length}</div>
            <p className="text-xs text-muted-foreground">
              types d'appareils différents
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formattedStats?.monthly_sales?.toLocaleString() || '0'} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              ce mois
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Panier moyen</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageBasket.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              par transaction
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions actives</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="analytics">Analyses</TabsTrigger>
        </TabsList>

        {/* Onglet Sessions actives */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sessions actives</CardTitle>
              <CardDescription>
                Vos sessions ouvertes sur différents appareils
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea style={{ height: SCROLL_AREA_HEIGHT }}>
                <div className="space-y-4">
                  {activeSessions.map((session) => (
                    <Card key={session.session_id} className="hover:bg-accent/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {getPlatformIcon(session.platform)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">
                                  {session.device_name || session.platform.toUpperCase()}
                                </h4>
                                {getStatusBadge(session.is_active, session.expires_at)}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Chrome className="h-3 w-3" />
                                  {session.browser || 'Browser inconnu'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Apple className="h-3 w-3" />
                                  {session.os || 'OS inconnu'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Dernière activité: {formatDate(session.last_activity)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {session.location_city || 'Localisation inconnue'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadSessionSales(session)}
                                >
                                  Voir ventes
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>
                                    Ventes - {session.device_name || session.platform}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Sessions du {formatDate(session.created_at)} au{' '}
                                    {session.is_active ? 'aujourd\'hui' : formatDate(session.expires_at)}
                                  </DialogDescription>
                                </DialogHeader>
                                {loadingSales && currentSessionForDialog?.session_id === session.session_id ? (
                                  <div className="flex justify-center p-8">
                                    <RefreshCw className="h-6 w-6 animate-spin" />
                                  </div>
                                ) : sessionSales && currentSessionForDialog?.session_id === session.session_id ? (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                      <Card>
                                        <CardContent className="p-4 text-center">
                                          <p className="text-2xl font-bold">{sessionSales.summary.total_sales}</p>
                                          <p className="text-xs text-muted-foreground">Ventes</p>
                                        </CardContent>
                                      </Card>
                                      <Card>
                                        <CardContent className="p-4 text-center">
                                          <p className="text-2xl font-bold">
                                            {sessionSales.summary.total_amount.toLocaleString()} FCFA
                                          </p>
                                          <p className="text-xs text-muted-foreground">Chiffre d'affaires</p>
                                        </CardContent>
                                      </Card>
                                      <Card>
                                        <CardContent className="p-4 text-center">
                                          <p className="text-2xl font-bold">
                                            {sessionSales.summary.average_basket.toLocaleString()} FCFA
                                          </p>
                                          <p className="text-xs text-muted-foreground">Panier moyen</p>
                                        </CardContent>
                                      </Card>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Référence</TableHead>
                                          <TableHead>Montant</TableHead>
                                          <TableHead>Paiement</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Articles</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {sessionSales.sales.map((sale) => (
                                          <TableRow key={sale.id}>
                                            <TableCell className="font-medium">{sale.reference}</TableCell>
                                            <TableCell>{sale.total_amount.toLocaleString()} FCFA</TableCell>
                                            <TableCell>{sale.payment_method}</TableCell>
                                            <TableCell>{formatDate(sale.created_at)}</TableCell>
                                            <TableCell>{sale.items_count}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <p className="text-center text-muted-foreground p-8">
                                    Aucune vente pour cette session
                                  </p>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => logoutSessionMutation.mutate(session.session_id)}
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des sessions</CardTitle>
              <CardDescription>
                Toutes vos sessions précédentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appareil</TableHead>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData?.sessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(session.platform)}
                          {session.device_name || session.platform}
                        </div>
                      </TableCell>
                      <TableCell>{session.platform}</TableCell>
                      <TableCell>{formatDate(session.created_at)}</TableCell>
                      <TableCell>
                        {session.is_active ? 'En cours' : formatDate(session.expires_at)}
                      </TableCell>
                      <TableCell>{getStatusBadge(session.is_active, session.expires_at)}</TableCell>
                      <TableCell>
                        {session.location_city ? `${session.location_city}, ${session.location_country}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadSessionSales(session)}
                        >
                          Voir ventes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Analyses */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sessions par plateforme</CardTitle>
                <CardDescription>
                  Répartition de vos connexions par type d'appareil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sessionsByPlatformData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const percentValue = percent ?? 0;
                        return `${name} ${(percentValue * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sessionsByPlatformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activité par plateforme</CardTitle>
                <CardDescription>
                  Nombre de sessions actives par type d'appareil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sessions" fill="#3b82f6" name="Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recommandations</CardTitle>
                <CardDescription>
                  Optimisez votre expérience multi-plateforme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platformStats.map(stat => (
                    <div key={stat.platform} className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                      <div className="mt-1">{getPlatformIcon(stat.platform)}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold">
                          {stat.platform.toUpperCase()}
                          {stat.sessions === 1 ? ' - Session active' : ` - ${stat.sessions} sessions actives`}
                        </h4>
                        {stat.platform === 'mobile' && (
                          <p className="text-sm text-muted-foreground">
                            💡 Pensez à installer l'application PWA pour une expérience optimale sur mobile
                          </p>
                        )}
                        {stat.platform === 'web' && stat.sessions > 1 && (
                          <p className="text-sm text-muted-foreground">
                            💡 Plusieurs sessions web actives. Assurez-vous de vous déconnecter des appareils non utilisés
                          </p>
                        )}
                        {stat.platform === 'pos' && (
                          <p className="text-sm text-muted-foreground">
                            💡 Le terminal POS est optimisé pour les ventes rapides. Pensez à synchroniser régulièrement
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AllPlatforms;