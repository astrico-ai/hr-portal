import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { getProjects } from '../lib/storage';
import BillableItemForm from './BillableItemForm';

const BillableItemFormWrapper = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    if (!projectId) {
      navigate('/invoices');
      return;
    }

    try {
      const projects = await getProjects();
      const project = projects.find(p => p.id === parseInt(projectId));
      if (!project) {
        navigate('/invoices');
        return;
      }
      setProject(project);
    } catch (error) {
      console.error('Failed to load project:', error);
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  }

  if (loading || !project) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <BillableItemForm
      project={project}
      onSuccess={() => {
        navigate('/invoices');
      }}
    />
  );
};

export default BillableItemFormWrapper; 