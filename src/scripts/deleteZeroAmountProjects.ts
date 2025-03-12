import { deleteProjectsWithZeroAmount } from '../lib/storage';

async function main() {
  try {
    await deleteProjectsWithZeroAmount();
    console.log('Successfully deleted projects with 0 amount');
  } catch (error) {
    console.error('Failed to delete projects:', error);
  }
}

main(); 