
import ProjectFormPage from '../../../../../components/projects/ProjectFormPage';

export default function EditProjectPage({ params }) {
  return <ProjectFormPage projectId={params.id} />;
}