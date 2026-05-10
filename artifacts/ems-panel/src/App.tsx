import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Roster from "@/pages/roster";
import ShiftRoster from "@/pages/shift-roster";
import EmsRoster from "@/pages/ems-roster";
import Dashboard from "@/pages/dashboard";
import MemberDetail from "@/pages/member-detail";
import AdminPanel from "@/pages/admin";
import Handbook from "@/pages/handbook";
import { API_ORIGIN } from "@/lib/api-base";
import DoctorLogin from "@/pages/doctor-login";
import DoctorDashboard from "@/pages/doctor-dashboard";
import DoctorAppointments from "@/pages/doctor-appointments";
import DoctorAppointmentDetail from "@/pages/doctor-appointment-detail";
import DoctorCalendar from "@/pages/doctor-calendar";
import DoctorPatients from "@/pages/doctor-patients";
import DoctorPatientDetail from "@/pages/doctor-patient-detail";
import DoctorMedicalRecords from "@/pages/doctor-medical-records";
import DoctorMfc from "@/pages/doctor-mfc";
import DoctorMfcDetail from "@/pages/doctor-mfc-detail";
import DoctorPrescriptions from "@/pages/doctor-prescriptions";
import DoctorPrescriptionDetail from "@/pages/doctor-prescription-detail";
import DoctorMedicines from "@/pages/doctor-medicines";
import DoctorPrices from "@/pages/doctor-prices";

const queryClient = new QueryClient();
setBaseUrl(API_ORIGIN);

function LegacyRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Roster} />
      <Route path="/shift-roster" component={ShiftRoster} />
      <Route path="/ems-roster" component={EmsRoster} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/stats">
        <LegacyRedirect to="/dashboard" />
      </Route>
      <Route path="/profile">
        <LegacyRedirect to="/ems-roster" />
      </Route>
      <Route path="/citations">
        <LegacyRedirect to="/admin" />
      </Route>
      <Route path="/member/:id" component={MemberDetail} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/handbook" component={Handbook} />
      <Route path="/doctor/login" component={DoctorLogin} />
      <Route path="/doctor" component={DoctorDashboard} />
      <Route path="/doctor/appointments" component={DoctorAppointments} />
      <Route path="/doctor/appointments/:id" component={DoctorAppointmentDetail} />
      <Route path="/doctor/calendar" component={DoctorCalendar} />
      <Route path="/doctor/patients" component={DoctorPatients} />
      <Route path="/doctor/patients/:id" component={DoctorPatientDetail} />
      <Route path="/doctor/medical-records" component={DoctorMedicalRecords} />
      <Route path="/doctor/mfc" component={DoctorMfc} />
      <Route path="/doctor/mfc/:id" component={DoctorMfcDetail} />
      <Route path="/doctor/prescriptions" component={DoctorPrescriptions} />
      <Route path="/doctor/prescriptions/:id" component={DoctorPrescriptionDetail} />
      <Route path="/doctor/medicines" component={DoctorMedicines} />
      <Route path="/doctor/prices" component={DoctorPrices} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
