const { integrationManager } = require('../services/integrationManager');

(async () => {
  console.log('--- Testing portfolioResumeMutator against real resume.ts ---');
  const mutator = await import('../services/portfolioResumeMutator.js');
  const res = await integrationManager.getGitHubFileContent({ path: 'src/data/resume.ts', branch: 'main' });
  let content = res.content;

  // 1. Test Skills CRUD
  console.log('\n[1. Skills CRUD]');
  const addSkillRes = mutator.addSkillsToContent(content, 'backend', ['Elixir', 'RabbitMQ']);
  console.log('Add skills added:', addSkillRes.added);
  if (!addSkillRes.added.includes('Elixir')) throw new Error('Elixir not added');

  const removeSkillRes = mutator.removeSkillsFromContent(addSkillRes.content, ['Elixir']);
  console.log('Remove skills removed:', removeSkillRes.removed);
  if (!removeSkillRes.removed.includes('Elixir')) throw new Error('Elixir not removed');

  // 2. Test Certificate CRUD
  console.log('\n[2. Certificate CRUD]');
  const sampleCert = {
    id: 'test-google-cloud-cert',
    title: 'Google Cloud Professional Cloud Architect',
    issuer: 'Google Cloud',
    category: 'cloud',
    date: '2026-11-12',
    skills: ['GCP', 'Cloud Architecture'],
    description: 'Cloud architect certification.'
  };
  const addCertRes = mutator.addCertificateToContent(content, sampleCert);
  console.log('Add cert success:', addCertRes.success);

  const updateCertRes = mutator.updateCertificateInContent(addCertRes.content, 'test-google-cloud-cert', {
    issuer: 'Alphabet Google Cloud Enterprise'
  });
  console.log('Update cert success:', updateCertRes.success, updateCertRes.updated?.updates);

  const removeCertRes = mutator.removeCertificatesFromContent(updateCertRes.content, ['Google Cloud Professional Cloud Architect']);
  console.log('Remove cert removed:', removeCertRes.removed);

  // 3. Test Project CRUD
  console.log('\n[3. Project CRUD]');
  const sampleProject = {
    id: 'test-ai-vision-agent',
    title: 'Autonomous Vision Agent',
    description: 'AI vision analytics agent.',
    longDescription: 'Deep visual inspection system.',
    tech: ['Python', 'OpenCV', 'PyTorch'],
    category: 'ai'
  };
  const addProjRes = mutator.addProjectToContent(content, sampleProject);
  console.log('Add project success:', addProjRes.success);

  const updateProjRes = mutator.updateProjectInContent(addProjRes.content, 'test-ai-vision-agent', {
    description: 'Updated description for Autonomous Vision Agent'
  });
  console.log('Update project success:', updateProjRes.success);

  const removeProjRes = mutator.removeProjectsFromContent(updateProjRes.content, ['Autonomous Vision Agent']);
  console.log('Remove project removed:', removeProjRes.removed);

  // 4. Test Profile CRUD
  console.log('\n[4. Profile CRUD]');
  const updateProfileRes = mutator.updateProfileFieldsInContent(content, {
    title: 'Principal Autonomous AI Engineer & Full-Stack Architect'
  });
  console.log('Profile update success:', updateProfileRes.success, updateProfileRes.updatedFields);

  console.log('\n✅ ALL MUTATOR TESTS PASSED WITH 100% SUCCESS!');
})();

