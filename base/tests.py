from django.test import TestCase
from django.urls import reverse
from django.urls import resolve
from django.contrib.auth.models import User
from base.views import tabular_data
from django.http import response

class TEST_view_to_url(TestCase):
    def test_3d(self):
        url = reverse('three_demension', args=[18])
        self.assertEqual(url, '/3D/18/')
        
    def test_region_group(self):
        url = reverse('region_group', args=[18,47])
        self.assertEqual(url, '/region_group/18/47/')
        
    def test_interactions(self):
        url = reverse('interactions', args=[18])
        self.assertEqual(url,'/network/18/interactions/')
        
    def test_correlations(self):
        url = reverse('correlations', args=[18])
        self.assertEqual(url, '/network/18/correlations/')
        
    def test_annotation(self):
        url = reverse('annotation', args=[15])
        self.assertEqual(url, '/annotation/15/')
        
    def test_tabular_data(self):
        url = reverse('tabular_fetch', args=[19,2873])
        self.assertEqual(url,'/network/19/tabular/2873/')

class TEST_url_to_view(TestCase):
    def test_3d(self):
        resolver = resolve('/3D/18/')
        self.assertEqual(resolver.view_name, 'three_demension')
        
    def test_region_group(self):
        resolver = resolve('/region_group/18/47/')
        self.assertEqual(resolver.view_name, 'region_group')
        
    def test_interactions(self):
        resolver = resolve('/annotation/15/')
        self.assertEqual(resolver.view_name, 'annotation')
        
    def test_correlations(self):
        resolver = resolve('/network/18/correlations/')
        self.assertEqual(resolver.view_name, 'correlations')
        
    def test_annotation(self):
        resolver = resolve('/annotation/15/')
        self.assertEqual(resolver.view_name, 'annotation')
        
    def test_tabular_data(self):
        resolver = resolve('/network/19/tabular/2873/')
        self.assertEqual(resolver.view_name, 'tabular_fetch')
        self.assertEqual(resolver.func, tabular_data)

class TEST_POST(TestCase):
    def setUp(self):
        self.user = {'username':'user2',
                     'password':'testingalldaylong'}
        self.user1 = User.objects.create_user(**self.user)
#
    def test_login(self):
        response = self.client.post('/login/', self.user, follow=True)
        self.assertTrue(response.context['user'].is_authenticated)
        print('login response status_code:',response.status_code)
        self.assertRedirects(response,'/password_change/',status_code=302,target_status_code=200)

#     def test_view(self):
#         request = Request(user1)
#         response = tabular_data(request,dataset_id=18,node_id=2873)
#         print('TEST_VIEW')
#         print('response: ',response)
#         print('status_code: ',response.status_code)
#         print('content:',response.content)
#         self.assertEqual(response.status_code, 200)
#         self.assertEqual(response.content, u'Hello world!')
#     def test_table(self):
#         response = self.client.get(reverse('tabular_fetch',kwargs={'dataset_id': 18, 'node_id':2873}))
#         print('TEST_TABLE')
#         print(response,response.status_code)
#     def test_tabular_data(self):
#         response = self.client.post(reverse('tabular_fetch', kwargs = {'dataset_id': 18,'node_id': 2873}), follow=True)
#         self.assertEqual(response.status_code,200)
#         print('response',response)
#         print('response.status_code',response.status_code)
        
#     def test_tabular_v2(self):
#         response = self.client.get(reverse('tabular_fetch', kwargs = {'dataset_id': 18,'node_id': 2873}))
#         json_string = response.content
#         print('response',response)
#         print('string',json_string)
#         resp = self.client.post(reverse('polls_detail', kwargs={'poll_id': 1}), {'choice': 1})
#         self.assertEqual(resp.status_code, 302)
#         self.assertEqual(resp['Location'], 'http://testserver/polls/1/results/')

#         response = self.client.post(
#             reverse('my_json_view',args=('test', 123)),
#             json.dumps({'user': 'me@example.com',}),
#             'json',HTTP_X_REQUESTED_WITH='XMLHttpRequest',)
#         json_string = response.content
#         response_data = json.loads(json_string)


