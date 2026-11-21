
import ProjectFormPage from '../../../projects/components/ProjectFormPage';

export default function EditProjectPage({ params }) {
  return <ProjectFormPage projectId={params.id} />;
}