from django.views import View, generic

from main.models.permission import StudyPermission
from main.views import load_study, StudyObjectMixin


class ImportView(StudyObjectMixin, generic.DetailView):
    template_name = 'edd_file_importer/import2.html'

    def get(self, request, *args, **kwargs):
        # load study to enforce permissions check... permissions should also be checked by back end
        # during user attempt to create the lines, but better to identify permissions errors before
        # loading the form
        pk = kwargs.get('pk')
        slug = kwargs.get('slug')
        load_study(request, pk=pk, slug=slug, permission_type=StudyPermission.CAN_EDIT)

        # render the template
        return super(ImportView, self).get(request, *args, **kwargs)
