from django.test import TestCase
from django.urls import reverse
from django.urls import resolve
from django.contrib.auth.models import User

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


# class TEST_POST(TestCase):
#     def setUp(self):
#         self.user = User.objects.create_user(username='myra', email='myra.masinas@utoronto.ca', password='November.26')
#     
#     def test_login(self):
#         self.assertTrue(self.user.is_authenticated())
# 
#     def test_login(self):
# #         login = self.client.login(username='myra',password='November.26')
# #         self.assertTrue(login)
#         response = self.client.post('/login/', {'username': 'myra', 'password': 'November.26'}, follow=True)
#         self.assertRedirects(response,'/',200)
#         self.assertTrue(response)
#         response = self.client.get('/')
#         self.assertEqual(response.status_code, 200)
        
#     def test_tabular_data(self):
#         url = reverse('tabular_fetch')
#         response = self.client.post(url,{'nodes':'2873'})
#         print(response.status_code)
#         print(response.content)
#         print(response.context)
