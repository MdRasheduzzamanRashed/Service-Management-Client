import Projects from "../projects/page";
import DashboardProjectsCard from "../../components/DashboardProjectsCard";
import DashboardContractsCard from '../../components/DashboardContractsCard';

export default function Dashboard() {
  return (
    <main>
      <section className=" space-y-4">
        <div className="flex justify-between">
          <h1>Service Management</h1>
          <button>+ Create Service Request</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          
          <DashboardProjectsCard></DashboardProjectsCard>
          <DashboardContractsCard></DashboardContractsCard>
          <div className="bg-slate-700 rounded p-4">
            <h3>My Service Requests</h3> <h2>30</h2>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <h3>All Service Requests</h3> <h2>30</h2>
          </div>
        </div>
      </section>
      <section className="">
        <Projects></Projects>
      </section>
    </main>
  );
}
