
import ProjectFormPage from '@/components/ProjectFormPage';

export default function EditProjectPage({ params }) {
  return <ProjectFormPage projectId={params.id} />;
}