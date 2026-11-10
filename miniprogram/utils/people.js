const { supabase } = require('./supabase');
const fields = 'id,certificate_name,nickname,photo_url,tags,description,qrcode_url,is_active,sort_order,certifications(id,certificate_no,qualification,initial_year,recent_year,certified_at,is_active)';
function presentPerson(person) {
  const certifications = (person.certifications || []).filter(c => c.is_active).map(c => ({
    ...c, date_text: c.certified_at || (c.initial_year ? `${c.initial_year}年` : '未提供'),
    recent_text: c.recent_year ? `${c.recent_year}年` : '',
  })).sort((a,b) => a.certificate_no.localeCompare(b.certificate_no));
  const qualifications = [...new Set(certifications.map(c => c.qualification))];
  return { ...person, certifications, qualifications, qualification: qualifications.join('、') };
}
async function listPeople() {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const {data,error} = await supabase.from('people').select(fields).eq('is_active',true).order('sort_order').order('id').range(offset,offset+499);
    if(error)throw error;
    all.push(...data.map(presentPerson));
    if(data.length<500)break;
  }
  return all.filter(p => p.certifications.length);
}
async function getPerson(id) {
  // Legacy shared URLs keep working after explicit profile merges.
  const alias = await supabase.from('person_aliases').select('person_id').eq('old_id',id).maybeSingle();
  if(alias.error)throw alias.error;
  const {data,error} = await supabase.from('people').select(fields).eq('id',alias.data ? alias.data.person_id : id).eq('is_active',true).single();
  if(error)throw error;
  const person=presentPerson(data);
  if(!person.certifications.length)throw new Error('暂无公开认证');
  return person;
}
module.exports={listPeople,getPerson,presentPerson};
